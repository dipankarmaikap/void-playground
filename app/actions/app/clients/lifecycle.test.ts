import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients, db } from '../../../data/db.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLogin,
  extractCsrf,
  getHtml,
  origin,
  postForm,
  submitForm,
} from '../../../../test/http.ts';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function clientIdFrom(profilePath: string) {
  return profilePath.slice(profilePath.lastIndexOf('/') + 1);
}

/** The rendered `<form>` whose `action` points at `actionPath`. */
function formFor(html: string, actionPath: string) {
  let actionAt = html.indexOf(`action="${actionPath}"`);
  assert.notEqual(actionAt, -1, `expected a form posting to ${actionPath}`);
  let start = html.lastIndexOf('<form', actionAt);
  let end = html.indexOf('</form>', actionAt);
  return html.slice(start, end);
}

/** The Active/Archived toggle itself, so nav links do not match its assertions. */
function statusToggle(html: string) {
  let match = html.match(/<nav aria-label="Client status"[\s\S]*?<\/nav>/);
  return match?.[0] ?? '';
}

async function createClient(sessionCookie: string, fields: Record<string, string>) {
  let response = await postForm(
    router,
    routes.app.clients.new.action.href(),
    fields,
    sessionCookie,
  );
  assert.equal(response.status, 302, 'a valid Client should be created');
  let location = response.headers.get('Location');
  assert.ok(location, 'create should redirect to the profile');
  return { id: clientIdFrom(location), profilePath: location };
}

function archive(sessionCookie: string, clientId: string) {
  return submitForm(
    router,
    routes.app.clients.show.href({ clientId }),
    routes.app.clients.lifecycle.archive.href({ clientId }),
    {},
    sessionCookie,
  );
}

function restore(sessionCookie: string, clientId: string) {
  return submitForm(
    router,
    routes.app.clients.show.href({ clientId }),
    routes.app.clients.lifecycle.restore.href({ clientId }),
    {},
    sessionCookie,
  );
}

async function csrfFrom(path: string, sessionCookie: string) {
  let html = await getHtml(router, path, sessionCookie);
  let token = extractCsrf(html);
  assert.ok(token, 'the page should render a CSRF token');
  return token;
}

describe('client lifecycle', () => {
  it('starts new Clients as Active and offers an Archive control', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let legalName = uniqueName('Active Start');
    let preferredName = uniqueName('Actively Known');

    let { id, profilePath } = await createClient(sessionCookie, {
      type: 'individual',
      legal_name: legalName,
      preferred_name: preferredName,
    });

    let row = await db.find(clients, id);
    assert.equal(row?.status, 'active');
    assert.equal(row?.archived_at, null);

    let profile = await getHtml(router, profilePath, sessionCookie);
    assert.match(profile, /<dd[^>]*>Active<\/dd>/);
    assert.match(profile, /Archive client/);
    assert.doesNotMatch(profile, /Restore client/);

    let archiveForm = formFor(
      profile,
      routes.app.clients.lifecycle.archive.href({ clientId: id }),
    );
    assert.match(archiveForm, /method="post"/);
    assert.match(archiveForm, /name="_csrf" value="[^"]+"/);
    assert.doesNotMatch(archiveForm, /Restore client/);
  });

  it('archives a Client without deleting its profile and confirms through status feedback', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let legalName = uniqueName('Archive Preserve');
    let tradingName = uniqueName('Archive Trading');
    let industry = uniqueName('Archived industry');

    let { id, profilePath } = await createClient(sessionCookie, {
      type: 'business',
      legal_name: legalName,
      trading_name: tradingName,
      industry,
    });
    let before = await db.find(clients, id);
    assert.ok(before);

    let archived = await archive(sessionCookie, id);
    assert.equal(archived.status, 302);
    assert.equal(archived.headers.get('Location'), profilePath);

    let after = await db.find(clients, id);
    assert.ok(after, 'archiving should keep the full row');
    assert.equal(after.status, 'archived');
    assert.ok(after.archived_at !== null && after.archived_at > 0, 'archived_at should be recorded');
    assert.equal(after.type, 'business');
    assert.equal(after.legal_name, legalName);
    assert.equal(after.trading_name, tradingName);
    assert.equal(after.industry, industry);
    assert.equal(after.created_at, before.created_at);
    assert.ok(after.updated_at >= before.updated_at, 'archiving should refresh updated_at');

    let profile = await getHtml(router, profilePath, sessionCookie);
    assert.match(profile, /<p role="status"[^>]*>Client archived<\/p>/);
    assert.match(profile, /<dd[^>]*>Archived<\/dd>/);
    assert.match(profile, /Restore client/);
    assert.doesNotMatch(profile, /Archive client/);

    let restoreForm = formFor(
      profile,
      routes.app.clients.lifecycle.restore.href({ clientId: id }),
    );
    assert.match(restoreForm, /method="post"/);
    assert.match(restoreForm, /name="_csrf" value="[^"]+"/);
  });

  it('hides archived Clients from the default directory and lists them in the archived view', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let keptName = uniqueName('Still Active');
    let archivedName = uniqueName('Now Archived');

    await createClient(sessionCookie, { type: 'individual', legal_name: keptName });
    let { id } = await createClient(sessionCookie, {
      type: 'individual',
      legal_name: archivedName,
    });
    assert.equal((await archive(sessionCookie, id)).status, 302);

    let activeHref = routes.app.clients.index.href();
    let archivedHref = routes.app.clients.index.href(
      {},
      { searchParams: { status: 'archived' } },
    );

    let activeDirectory = await getHtml(router, activeHref, sessionCookie);
    assert.match(activeDirectory, new RegExp(keptName));
    assert.doesNotMatch(activeDirectory, new RegExp(archivedName));
    assert.match(
      statusToggle(activeDirectory),
      /href="\/app\/clients"[^>]*aria-current="page"[^>]*>Active<\/a>/,
    );
    assert.match(statusToggle(activeDirectory), /href="[^"]*status=archived"[^>]*>Archived<\/a>/);

    let archivedDirectory = await getHtml(router, archivedHref, sessionCookie);
    assert.match(archivedDirectory, new RegExp(archivedName));
    assert.doesNotMatch(archivedDirectory, new RegExp(keptName));
    assert.match(
      statusToggle(archivedDirectory),
      /href="[^"]*status=archived"[^>]*aria-current="page"[^>]*>Archived<\/a>/,
    );
    assert.match(statusToggle(archivedDirectory), /href="\/app\/clients"[^>]*>Active<\/a>/);
  });

  it('restores an archived Client to Active and keeps its details', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let legalName = uniqueName('Restore Me');
    let preferredName = uniqueName('Restored');

    let { id, profilePath } = await createClient(sessionCookie, {
      type: 'individual',
      legal_name: legalName,
      preferred_name: preferredName,
    });
    assert.equal((await archive(sessionCookie, id)).status, 302);

    let restored = await restore(sessionCookie, id);
    assert.equal(restored.status, 302);
    assert.equal(restored.headers.get('Location'), profilePath);

    let row = await db.find(clients, id);
    assert.equal(row?.status, 'active');
    assert.equal(row?.archived_at, null);
    assert.equal(row?.legal_name, legalName);
    assert.equal(row?.preferred_name, preferredName);

    let profile = await getHtml(router, profilePath, sessionCookie);
    assert.match(profile, /<p role="status"[^>]*>Client restored<\/p>/);
    assert.match(profile, /<dd[^>]*>Active<\/dd>/);
    assert.match(profile, /Archive client/);

    let directory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(legalName));
  });

  it('does not archive or restore another Organization’s Client', async () => {
    let firstCookie = await createUserAndLogin(router, 'lifecycle');
    let secondCookie = await createUserAndLogin(router, 'lifecycle');
    let legalName = uniqueName('Shared Lifecycle');

    let { id } = await createClient(firstCookie, {
      type: 'individual',
      legal_name: legalName,
    });

    let foreignArchive = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.archive.href({ clientId: id }),
      {},
      secondCookie,
    );
    assert.equal(foreignArchive.status, 404);
    assert.equal((await db.find(clients, id))?.status, 'active');

    assert.equal((await archive(firstCookie, id)).status, 302);
    assert.equal((await db.find(clients, id))?.status, 'archived');

    let foreignRestore = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.restore.href({ clientId: id }),
      {},
      secondCookie,
    );
    assert.equal(foreignRestore.status, 404);
    assert.equal((await db.find(clients, id))?.status, 'archived');

    assert.equal((await restore(firstCookie, id)).status, 302);
    assert.equal((await db.find(clients, id))?.status, 'active');
  });

  it('rejects lifecycle mutations without a CSRF token', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let legalName = uniqueName('No Token Lifecycle');
    let { id } = await createClient(sessionCookie, {
      type: 'individual',
      legal_name: legalName,
    });

    let archiveAttempt = await router.fetch(
      new URL(routes.app.clients.lifecycle.archive.href({ clientId: id }), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: '',
      },
    );
    assert.equal(archiveAttempt.status, 403);
    assert.equal((await db.find(clients, id))?.status, 'active');

    assert.equal((await archive(sessionCookie, id)).status, 302);

    let restoreAttempt = await router.fetch(
      new URL(routes.app.clients.lifecycle.restore.href({ clientId: id }), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: '',
      },
    );
    assert.equal(restoreAttempt.status, 403);
    assert.equal((await db.find(clients, id))?.status, 'archived');
  });

  it('protects the archived directory and lifecycle pages from anonymous visitors', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let { id, profilePath } = await createClient(sessionCookie, {
      type: 'individual',
      legal_name: uniqueName('Private Lifecycle'),
    });
    assert.equal((await archive(sessionCookie, id)).status, 302);

    for (let path of [
      routes.app.clients.index.href({}, { searchParams: { status: 'archived' } }),
      profilePath,
    ]) {
      let response = await router.fetch(new URL(path, origin));
      assert.equal(response.status, 302, `${path} should redirect`);
      assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
    }
  });

  it('returns 404 for lifecycle actions on unknown Clients', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    let clientId = crypto.randomUUID();
    let csrf = await csrfFrom(routes.app.clients.index.href(), sessionCookie);

    for (let path of [
      routes.app.clients.lifecycle.archive.href({ clientId }),
      routes.app.clients.lifecycle.restore.href({ clientId }),
    ]) {
      let response = await router.fetch(new URL(path, origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({ _csrf: csrf }).toString(),
      });
      assert.equal(response.status, 404, `${path} should be 404`);
    }
  });

  it('shows a useful empty state in both directory views', async () => {
    let sessionCookie = await createUserAndLogin(router, 'lifecycle');
    await db.exec('DELETE FROM clients');

    let archivedDirectory = await getHtml(
      router,
      routes.app.clients.index.href({}, { searchParams: { status: 'archived' } }),
      sessionCookie,
    );
    assert.match(archivedDirectory, /No archived clients\./);

    let activeDirectory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(activeDirectory, /No active clients yet\./);
  });
});
