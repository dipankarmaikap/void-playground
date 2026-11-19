import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';
import { db, organizationMemberships, users } from '../../data/db.ts';
import '../../../test/db-setup.ts';
import { findOrganizationForUser } from '../../data/organization/access.ts';
import { createUser, login, origin, postForm } from '../../../test/http.ts';

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

function beforeLogout(html: string) {
  return html.slice(0, html.indexOf('action="/logout"'));
}

async function postProfile(
  sessionCookie: string,
  body: Record<string, string>,
  options: { includeCsrf?: boolean } = {},
) {
  let url = routes.app.settings.profile.action.href();
  if (options.includeCsrf === false) {
    return router.fetch(new URL(url, origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(body).toString(),
    });
  }
  return postForm(router, url, body, sessionCookie);
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
    assert.match(
      html,
      /<\/details>\s*<aside[^>]*>[\s\S]*?<nav aria-label="Main"/,
      'the desktop sidebar should not be inside the collapsed mobile disclosure',
    );
    assert.match(html, /<nav aria-label="Main"/);
    assert.doesNotMatch(html, /<nav aria-label="Settings"/);
    for (let href of [
      routes.app.dashboard.href(),
      routes.app.settings.profile.index.href(),
    ]) {
      assert.match(
        html,
        new RegExp(`<a[^>]*href="${href}"[^>]*data-rmx-document`),
        `${href} should navigate as a full document so the mobile drawer closes`,
      );
    }
    assert.match(html, /<a[^>]*href="\/app\/dashboard"[^>]*aria-current="page"/);
    assert.match(html, /<a[^>]*href="\/app\/settings"[^>]*>[\s\S]*?Settings[\s\S]*?<\/a>/);
    assert.doesNotMatch(html, /<a[^>]*href="\/app\/settings"[^>]*aria-current="page"/);
    assert.match(html, new RegExp(email));
    assert.match(html, /action="\/logout"/);
    assert.match(html, /name="_csrf" value="[^"]+"/);
    assert.match(html, /Log out/);
    assert.match(html, /<main id="main"/);
  });

  it('offers Invoices in the main navigation alongside Dashboard and Clients', async () => {
    let { sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);
    let mainNav = html.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? '';

    assert.match(mainNav, /Dashboard[\s\S]*Clients[\s\S]*Invoices[\s\S]*Settings/);
    assert.match(mainNav, /href="\/app\/invoices"[^>]*data-rmx-document/);
  });

  it('identifies the current Organization without replacing product or User identity', async () => {
    let { email, userId, sessionCookie } = await loginNewUser('Ada Lovelace');
    let organization = await findOrganizationForUser(db, { id: userId });
    assert.ok(organization);

    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);
    let sidebar = beforeLogout(html);

    assert.ok(sidebar.includes(organization.name));
    assert.ok(sidebar.includes('My Remix App'));
    assert.ok(sidebar.includes('Ada Lovelace'));
    assert.ok(sidebar.includes(email));
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
    assert.match(
      html,
      /<nav aria-label="Settings"[\s\S]*?Profile[\s\S]*?Sessions[\s\S]*?<\/nav>/,
    );
    assert.match(html, /<a[^>]*href="\/app\/settings"[^>]*aria-current="page"/);
    assert.match(html, new RegExp(email));
    assert.match(html, /action="\/logout"/);
    assert.match(html, /<main id="main"[\s\S]*?<h1[^>]*>Profile<\/h1>/);
  });

  it('shows the current Organization and an accessible name form in Settings', async () => {
    let { email, userId, sessionCookie } = await loginNewUser('Ada Lovelace');
    let organization = await findOrganizationForUser(db, { id: userId });
    assert.ok(organization);

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );

    assert.match(html, /<h2[^>]*id="organization-heading"[^>]*>Organization<\/h2>/);
    assert.ok(html.includes(organization.name));
    assert.match(
      html,
      /<label[^>]*>Organization name[\s\S]*?<input[^>]*name="organization_name"[^>]*autocomplete="organization"[^>]*required/,
    );
    assert.ok(html.includes('Ada Lovelace'));
    assert.ok(html.includes(email));
  });

  it('renames only the owner Organization and keeps the User display name unchanged', async () => {
    let owner = await loginNewUser('Ada Lovelace');
    let other = await loginNewUser('Grace Hopper');
    let organization = await findOrganizationForUser(db, { id: owner.userId });
    let otherOrganization = await findOrganizationForUser(db, { id: other.userId });
    assert.ok(organization);
    assert.ok(otherOrganization);
    let renamed = `Renamed Studio ${crypto.randomUUID()}`;

    let response = await postProfile(owner.sessionCookie, {
      organization_name: `  ${renamed}  `,
      organization_id: otherOrganization.id,
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.settings.profile.index.href());

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      owner.sessionCookie,
    );
    assert.match(html, /<p role="status"[^>]*>Organization name updated<\/p>/);
    assert.match(html, new RegExp(`name="organization_name"[^>]*value="${renamed}"`));
    assert.ok(html.includes('Ada Lovelace'));
    assert.equal((await findOrganizationForUser(db, { id: owner.userId }))?.name, renamed);
    assert.equal((await findOrganizationForUser(db, { id: other.userId }))?.name, otherOrganization.name);

    let user = await db.find(users, owner.userId);
    assert.equal(user?.display_name, 'Ada Lovelace');
  });

  it('does not let a non-owner rename their Organization', async () => {
    let owner = await loginNewUser();
    let member = await loginNewUser();
    let organization = await findOrganizationForUser(db, { id: owner.userId });
    assert.ok(organization);

    await db.deleteMany(organizationMemberships, { where: { user_id: member.userId } });
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      user_id: member.userId,
      is_owner: false,
      created_at: Date.now(),
    });

    let response = await postProfile(member.sessionCookie, {
      organization_name: 'Unauthorized rename',
    });

    assert.equal(response.status, 403);
    assert.equal((await findOrganizationForUser(db, { id: owner.userId }))?.name, organization.name);
  });

  it('rejects a blank Organization name with accessible feedback and keeps the saved name', async () => {
    let { userId, sessionCookie } = await loginNewUser();
    let organization = await findOrganizationForUser(db, { id: userId });
    assert.ok(organization);

    let response = await postProfile(sessionCookie, { organization_name: '   ' });
    assert.equal(response.status, 302);

    let html = await getAuthenticatedHtml(
      routes.app.settings.profile.index.href(),
      sessionCookie,
    );
    assert.match(
      html,
      /<p id="organization-name-error" role="alert"[^>]*>Organization name is required<\/p>/,
    );
    assert.match(html, /name="organization_name"[^>]*aria-invalid="true"/);
    assert.match(html, /name="organization_name"[^>]*value=" {3}"/);
    assert.equal((await findOrganizationForUser(db, { id: userId }))?.name, organization.name);
  });

  it('rejects an Organization rename without a CSRF token', async () => {
    let { userId, sessionCookie } = await loginNewUser();
    let organization = await findOrganizationForUser(db, { id: userId });
    assert.ok(organization);

    let response = await postProfile(
      sessionCookie,
      { organization_name: 'No token rename' },
      { includeCsrf: false },
    );

    assert.equal(response.status, 403);
    assert.equal((await findOrganizationForUser(db, { id: userId }))?.name, organization.name);
  });

  it('allows different Organizations to use the same name through Settings', async () => {
    let first = await loginNewUser();
    let second = await loginNewUser();
    let firstOrganization = await findOrganizationForUser(db, { id: first.userId });
    let secondOrganization = await findOrganizationForUser(db, { id: second.userId });
    assert.ok(firstOrganization);
    assert.ok(secondOrganization);

    let response = await postProfile(first.sessionCookie, {
      organization_name: secondOrganization.name,
    });
    assert.equal(response.status, 302);

    assert.equal(
      (await findOrganizationForUser(db, { id: first.userId }))?.name,
      secondOrganization.name,
    );
    assert.equal(
      (await findOrganizationForUser(db, { id: second.userId }))?.name,
      secondOrganization.name,
    );
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
    let organization = await findOrganizationForUser(db, { id: userId });
    assert.ok(organization);
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
    assert.equal((await findOrganizationForUser(db, { id: userId }))?.name, organization.name);
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
    let sidebar = beforeLogout(html);
    assert.ok(sidebar.includes('Ada Lovelace'));
    assert.ok(sidebar.includes(email));
    assert.ok(sidebar.indexOf('Ada Lovelace') < sidebar.indexOf(email));
  });

  it('falls back to the email identity when no display name is set', async () => {
    let { email, sessionCookie } = await loginNewUser();
    let html = await getAuthenticatedHtml(routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /Welcome back, /);
    assert.ok(html.includes(`Welcome back, ${email}`));
    let sidebar = beforeLogout(html);
    assert.ok(sidebar.includes(email));
  });

  it('threads the display name into the sessions shell', async () => {
    let { email, sessionCookie } = await loginNewUser('Ada Lovelace');
    let html = await getAuthenticatedHtml(
      routes.app.settings.sessions.index.href(),
      sessionCookie,
    );

    let sidebar = beforeLogout(html);
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
    assert.match(
      html,
      /<nav aria-label="Settings"[\s\S]*?Profile[\s\S]*?Sessions[\s\S]*?<\/nav>/,
    );
    assert.match(html, /<a[^>]*href="\/app\/settings\/sessions"[^>]*aria-current="page"/);
    assert.match(html, /<h1[^>]*>Sessions<\/h1>/);
    assert.match(html, /This session/);
    assert.match(html, /action="\/logout"/);
  });

  it('marks dashboard, Profile, Sessions, and Client HTML as private and non-storing', async () => {
    let { sessionCookie } = await loginNewUser();
    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: `Cache Client ${crypto.randomUUID()}` },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let clientPath = created.headers.get('Location');
    assert.ok(clientPath);
    let clientId = new URL(clientPath, origin).pathname.split('/').at(-1);
    assert.ok(clientId);

    let paths = [
      routes.app.dashboard.href(),
      routes.app.settings.profile.index.href(),
      routes.app.settings.sessions.index.href(),
      routes.app.clients.index.href(),
      clientPath,
      routes.app.clients.new.index.href(),
      routes.app.clients.edit.index.href({ clientId }),
    ];

    for (let path of paths) {
      let response = await router.fetch(new URL(path, origin), {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(response.status, 200, `${path} should render`);
      assert.equal(
        response.headers.get('Cache-Control'),
        'private, no-store',
        `${path} should not be stored by browser or shared caches`,
      );
    }
  });
});
