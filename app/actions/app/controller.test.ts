import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';
import { db, users } from '../../data/db.ts';
import { createUser, extractCsrf, login, origin } from '../../../test/http.ts';

async function loginNewUser(displayName: string | null = null) {
  let email = `app-${crypto.randomUUID()}@example.com`;
  let userId = await createUser(email, 'password123', true, displayName);
  let sessionCookie = await login(router, email, 'password123');
  return { email, userId, sessionCookie };
}

async function getAuthenticatedHtml(path: string, sessionCookie: string) {
  let response = await router.fetch(new URL(path, origin), {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  return response.text();
}

async function postProfile(
  sessionCookie: string,
  body: Record<string, string>,
  options: { includeCsrf?: boolean } = {},
) {
  let params = new URLSearchParams(body);
  if (options.includeCsrf !== false) {
    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );
    params.set('_csrf', extractCsrf(html));
  }
  return router.fetch(new URL(routes.app.settings.profile.action.href(), origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: params.toString(),
  });
}

describe('app controller', () => {
  it('redirects anonymous visitors from every authenticated page to /login', async () => {
    let paths = [
      routes.app.dashboard.href(),
      routes.app.settings.profile.index.href(),
      routes.app.settings.sessions.index.href(),
    ];

    for (let path of paths) {
      let response = await router.fetch(new URL(path, origin));

      assert.equal(response.status, 302, `${path} should redirect`);
      assert.equal(
        response.headers.get('Location'),
        routes.auth.login.index.href(),
        `${path} should redirect to login`,
      );
    }
  });

  it('renders the dashboard shell with navigation, identity, and logout', async () => {
    let { email, sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /<title>Dashboard \| My Remix App<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]*dashboard/i);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<summary[^>]*>[\s\S]*?Menu[\s\S]*?<\/summary>/);
    assert.match(html, /<nav aria-label="Main"/);
    assert.match(html, /<nav aria-label="Settings"/);
    for (let href of ['/app/dashboard', '/app/settings', '/app/settings/sessions']) {
      assert.match(
        html,
        new RegExp(`<a[^>]*href="${href}"[^>]*data-rmx-document`),
        `${href} should navigate as a full document so the mobile drawer closes`,
      );
    }
    assert.match(html, /<a[^>]*href="\/app\/dashboard"[^>]*aria-current="page"/);
    assert.match(html, /<a[^>]*href="\/app\/settings"[^>]*>[\s\S]*?Profile[\s\S]*?<\/a>/);
    assert.match(
      html,
      /<a[^>]*href="\/app\/settings\/sessions"[^>]*>[\s\S]*?Sessions[\s\S]*?<\/a>/,
    );
    assert.match(html, new RegExp(email));
    assert.match(html, /action="\/logout"/);
    assert.match(html, /name="_csrf" value="[^"]+"/);
    assert.match(html, /Log out/);
    assert.match(html, /<main id="main"/);
  });

  it('gives the dashboard shortcuts to Profile and Sessions', async () => {
    let { sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /href="\/app\/settings"/);
    assert.match(html, /href="\/app\/settings\/sessions"/);
    assert.match(html, /Welcome back/);
  });

  it('renders the profile page inside the shell', async () => {
    let { email, sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );

    assert.match(html, /<title>Profile \| My Remix App<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]*display name/i);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<nav aria-label="Main"/);
    assert.match(html, /<nav aria-label="Settings"/);
    assert.match(html, /<a[^>]*href="\/app\/settings"[^>]*aria-current="page"/);
    assert.match(html, new RegExp(email));
    assert.match(html, /action="\/logout"/);
    assert.match(html, /<main id="main"[\s\S]*?<h1[^>]*>Profile<\/h1>/);
  });

  it('renders the profile form with the current display name', async () => {
    let { email, sessionCookie } = await loginNewUser('Ada Lovelace');
    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );

    assert.match(html, /<form[^>]*method="post"[^>]*action="\/app\/settings"/);
    assert.match(html, /name="display_name"[^>]*value="Ada Lovelace"/);
    assert.match(html, /autocomplete="nickname"/);
    assert.match(html, /maxlength="80"/);
    assert.match(html, /Save profile/);
    assert.match(html, /name="_csrf" value="[^"]+"/);
    assert.match(html, /Ada Lovelace/);
    assert.ok(html.includes(email));
  });

  it('updates the display name through the CSRF-protected profile form', async () => {
    let { userId, sessionCookie } = await loginNewUser();
    let response = await postProfile(sessionCookie, { display_name: '  Grace Hopper  ' });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.settings.profile.index.href());

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );
    assert.match(html, /<p role="status"[^>]*>Profile updated<\/p>/);
    assert.match(html, /name="display_name"[^>]*value="Grace Hopper"/);

    let user = await db.find(users, userId);
    assert.equal(user?.display_name, 'Grace Hopper');
  });

  it('clears the display name with a blank submission', async () => {
    let { userId, sessionCookie } = await loginNewUser('Ada Lovelace');
    let response = await postProfile(sessionCookie, { display_name: '   ' });

    assert.equal(response.status, 302);

    let user = await db.find(users, userId);
    assert.equal(user?.display_name, null);

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );
    assert.match(html, /Not set/);
    assert.match(html, /name="display_name"[^>]*value=""/);
  });

  it('rejects an overlong display name and keeps the submitted value', async () => {
    let { userId, sessionCookie } = await loginNewUser();
    let tooLong = 'y'.repeat(81);
    let response = await postProfile(sessionCookie, { display_name: tooLong });

    assert.equal(response.status, 302);

    let user = await db.find(users, userId);
    assert.equal(user?.display_name, null);

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );
    assert.match(html, /<p role="alert"[^>]*>[^<]*80 characters[^<]*<\/p>/);
    assert.match(html, /name="display_name"[^>]*value="y{81}"/);
  });

  it('rejects a profile POST without a CSRF token', async () => {
    let { sessionCookie } = await loginNewUser();
    let response = await postProfile(
      sessionCookie,
      { display_name: 'Nobody' },
      { includeCsrf: false },
    );

    assert.equal(response.status, 403);
  });

  it('shows the display name with the email beneath in the dashboard and sidebar', async () => {
    let { email, sessionCookie } = await loginNewUser('Ada Lovelace');
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /Welcome back, Ada Lovelace/);
    let sidebar = html.slice(0, html.indexOf('action="/logout"'));
    assert.ok(sidebar.includes('Ada Lovelace'));
    assert.ok(sidebar.includes(email));
    assert.ok(sidebar.indexOf('Ada Lovelace') < sidebar.indexOf(email));
  });

  it('falls back to the email identity when no display name is set', async () => {
    let { email, sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /Welcome back, /);
    assert.ok(html.includes(`Welcome back, ${email}`));
    let sidebar = html.slice(0, html.indexOf('action="/logout"'));
    assert.ok(sidebar.includes(email));
  });

  it('threads the display name into the sessions shell', async () => {
    let { email, sessionCookie } = await loginNewUser('Ada Lovelace');
    let html = await getAuthenticatedHtml(
      routes.app.settings.sessions.index.href(),
      sessionCookie,
    );

    let sidebar = html.slice(0, html.indexOf('action="/logout"'));
    assert.ok(sidebar.includes('Ada Lovelace'));
    assert.ok(sidebar.indexOf('Ada Lovelace') < sidebar.indexOf(email));
  });

  it('renders the sessions page inside the shell', async () => {
    let { sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(
      routes.app.settings.sessions.index.href(),
      sessionCookie,
    );

    assert.match(html, /<title>Sessions \| My Remix App<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]*browsers signed in/i);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<a[^>]*href="\/app\/settings\/sessions"[^>]*aria-current="page"/);
    assert.match(html, /<h1[^>]*>Sessions<\/h1>/);
    assert.match(html, /This session/);
    assert.match(html, /action="\/logout"/);
  });
});
