import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';
import { createUser, login, origin } from '../../../test/http.ts';

async function loginNewUser() {
  let email = `app-${crypto.randomUUID()}@example.com`;
  await createUser(email, 'password123');
  let sessionCookie = await login(router, email, 'password123');
  return { email, sessionCookie };
}

async function getAuthenticatedHtml(path: string, sessionCookie: string) {
  let response = await router.fetch(new URL(path, origin), {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  return response.text();
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
