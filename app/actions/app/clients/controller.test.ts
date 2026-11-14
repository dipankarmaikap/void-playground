import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { db, clients } from '../../../data/db.ts';
import { createUser, extractCsrf, login, origin, postForm } from '../../../../test/http.ts';

async function loginNewUser(displayName: string | null = null) {
  let email = `clients-${crypto.randomUUID()}@example.com`;
  await createUser(email, 'password123', true, displayName);
  let sessionCookie = await login(router, email, 'password123');
  return { email, sessionCookie };
}

async function getHtml(path: string, sessionCookie: string) {
  let response = await router.fetch(new URL(path, origin), {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200, `${path} should render`);
  return response.text();
}

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

describe('clients controller', () => {
  it('redirects anonymous visitors from client pages to /login', async () => {
    let paths = [
      routes.app.clients.index.href(),
      routes.app.clients.new.index.href(),
      routes.app.clients.show.href({ clientId: crypto.randomUUID() }),
      routes.app.clients.edit.index.href({ clientId: crypto.randomUUID() }),
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

  it('adds the Clients destination to the app shell without a Settings subnav', async () => {
    let { sessionCookie } = await loginNewUser();
    let html = await getHtml(routes.app.clients.index.href(), sessionCookie);

    assert.match(
      html,
      /<a[^>]*href="\/app\/clients"[^>]*aria-current="page"[^>]*>[\s\S]*?Clients[\s\S]*?<\/a>/,
    );
    assert.match(
      html,
      /<a[^>]*href="\/app\/clients"[^>]*data-rmx-document/,
      'the Clients link should navigate as a full document so the mobile drawer closes',
    );
    assert.doesNotMatch(html, /<nav aria-label="Settings"/);
  });

  it('renders the directory and create page with route metadata and noindex', async () => {
    let { sessionCookie } = await loginNewUser();

    let directory = await getHtml(routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, /<title>Clients \| My Remix App<\/title>/);
    assert.match(directory, /<meta name="description" content="[^"]*client/i);
    assert.match(directory, /<meta name="robots" content="noindex"/);
    assert.match(directory, /<h1[^>]*>Clients<\/h1>/);
    assert.match(directory, new RegExp(`href="${routes.app.clients.new.index.href()}"`));

    let newPage = await getHtml(routes.app.clients.new.index.href(), sessionCookie);
    assert.match(newPage, /<title>New client \| My Remix App<\/title>/);
    assert.match(newPage, /<meta name="robots" content="noindex"/);
    assert.match(
      newPage,
      new RegExp(`<form[^>]*method="post"[^>]*action="${routes.app.clients.new.action.href()}"`),
    );
    assert.match(newPage, /name="_csrf" value="[^"]+"/);
    assert.match(newPage, /name="type"/);
    assert.match(newPage, /name="legal_name"/);
  });

  it('creates, views, and edits an Individual client', async () => {
    let { sessionCookie } = await loginNewUser();
    let legalName = uniqueName('Ada Lovelace');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'individual',
        legal_name: legalName,
        preferred_name: 'Ada',
      },
      sessionCookie,
    );

    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location, 'create should redirect to the profile');

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row, 'the client should be persisted');
    assert.equal(location, routes.app.clients.show.href({ clientId: row.id }));
    assert.equal(row.type, 'individual');
    assert.equal(row.preferred_name, 'Ada');
    assert.equal(row.status, 'active');
    assert.ok(row.created_at > 0);
    assert.ok(row.updated_at > 0);

    let profile = await getHtml(location, sessionCookie);
    assert.match(profile, /Ada/);
    assert.match(profile, /<p role="status"[^>]*>Client created<\/p>/);
    assert.match(profile, /<meta name="robots" content="noindex"/);
    assert.match(profile, /<title>Ada \| My Remix App<\/title>/);

    let editPage = await getHtml(
      routes.app.clients.edit.index.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, /<title>Edit Ada \| My Remix App<\/title>/);
    assert.match(editPage, /name="_csrf" value="[^"]+"/);
    assert.ok(editPage.includes(legalName), 'the edit form should load the stored name');

    let updatedName = uniqueName('Ada King');
    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      { type: 'individual', legal_name: updatedName, preferred_name: 'Ada' },
      sessionCookie,
    );

    assert.equal(edited.status, 302);
    assert.equal(
      edited.headers.get('Location'),
      routes.app.clients.show.href({ clientId: row.id }),
    );

    let editedRow = await db.find(clients, row.id);
    assert.equal(editedRow?.legal_name, updatedName);
    assert.equal(editedRow?.preferred_name, 'Ada');

    let updatedProfile = await getHtml(location, sessionCookie);
    assert.match(updatedProfile, /<p role="status"[^>]*>Client updated<\/p>/);
    assert.match(updatedProfile, new RegExp(updatedName));
  });

  it('requires a type and legal name and preserves submitted values', async () => {
    let { sessionCookie } = await loginNewUser();
    let preferredName = uniqueName('Preferred');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: '', legal_name: '', preferred_name: preferredName },
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Choose Individual or Business\./);
    assert.match(html, /Enter the legal name\./);
    assert.match(html, /name="legal_name"[^>]*value=""/);
    assert.match(html, /name="legal_name"[^>]*aria-invalid="true"/);
    assert.match(html, new RegExp(`name="preferred_name"[^>]*value="${preferredName}"`));
    assert.match(html, /<meta name="robots" content="noindex"/);

    let persisted = await db.findOne(clients, { where: { preferred_name: preferredName } });
    assert.equal(persisted, null, 'invalid submissions should not create a client');
  });

  it('keeps the stored profile when an edit fails validation', async () => {
    let { sessionCookie } = await loginNewUser();
    let legalName = uniqueName('Grace Hopper');
    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let preferredName = uniqueName('Amazing Grace');
    let response = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      { type: 'individual', legal_name: '', preferred_name: preferredName },
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter the legal name\./);
    assert.match(html, new RegExp(`name="preferred_name"[^>]*value="${preferredName}"`));

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.legal_name, legalName);
    assert.equal(stored?.preferred_name, null);
  });

  it('rejects Client mutations without a CSRF token', async () => {
    let { sessionCookie } = await loginNewUser();
    let legalName = uniqueName('No Token');

    let response = await router.fetch(new URL(routes.app.clients.new.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({ type: 'individual', legal_name: legalName }).toString(),
    });

    assert.equal(response.status, 403);
    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('shares one client book between authenticated users', async () => {
    let first = await loginNewUser();
    let second = await loginNewUser();
    let legalName = uniqueName('Shared Client');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName },
      first.sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let secondProfile = await getHtml(location, second.sessionCookie);
    assert.match(secondProfile, new RegExp(legalName));

    let updatedName = uniqueName('Shared Client Updated');
    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      { type: 'individual', legal_name: updatedName },
      second.sessionCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.legal_name, updatedName);

    let anonymous = await router.fetch(new URL(location, origin));
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('Location'), routes.auth.login.index.href());
  });

  it('uses the preferred name as the display label and falls back to the legal name', async () => {
    let { sessionCookie } = await loginNewUser();
    let legalName = uniqueName('Katherine Johnson');
    let preferredName = uniqueName('Kathy');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, preferred_name: preferredName },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let withPreferred = created.headers.get('Location');
    assert.ok(withPreferred);

    let directory = await getHtml(routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(preferredName));
    assert.match(directory, new RegExp(legalName));

    let profile = await getHtml(withPreferred, sessionCookie);
    assert.match(profile, new RegExp(`<title>${preferredName} \\| My Remix App<\\/title>`));

    let fallbackName = uniqueName('Dorothy Vaughan');
    let fallback = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: fallbackName, preferred_name: '' },
      sessionCookie,
    );
    assert.equal(fallback.status, 302);
    let fallbackLocation = fallback.headers.get('Location');
    assert.ok(fallbackLocation);
    let fallbackProfile = await getHtml(fallbackLocation, sessionCookie);
    assert.match(fallbackProfile, new RegExp(`<title>${fallbackName} \\| My Remix App<\\/title>`));
  });

  it('shows only active clients in the directory', async () => {
    let { sessionCookie } = await loginNewUser();
    let activeName = uniqueName('Active Client');
    let archivedName = uniqueName('Archived Client');

    await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: activeName },
      sessionCookie,
    );
    await db.create(clients, {
      id: crypto.randomUUID(),
      type: 'individual',
      legal_name: archivedName,
      status: 'archived',
      archived_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    let directory = await getHtml(routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(activeName));
    assert.doesNotMatch(directory, new RegExp(archivedName));
  });

  it('returns 404 for unknown clients on read and write routes', async () => {
    let { sessionCookie } = await loginNewUser();
    let clientId = crypto.randomUUID();

    for (let path of [
      routes.app.clients.show.href({ clientId }),
      routes.app.clients.edit.index.href({ clientId }),
    ]) {
      let response = await router.fetch(new URL(path, origin), {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(response.status, 404, `${path} should be 404`);
    }

    let newPage = await getHtml(routes.app.clients.new.index.href(), sessionCookie);
    let csrf = extractCsrf(newPage);
    let write = await router.fetch(
      new URL(routes.app.clients.edit.action.href({ clientId }), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({
          type: 'individual',
          legal_name: uniqueName('Ghost'),
          _csrf: csrf,
        }).toString(),
      },
    );
    assert.equal(write.status, 404);
  });
});
