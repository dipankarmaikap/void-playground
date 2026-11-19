import * as assert from 'remix/assert';
import { beforeEach, describe, it } from 'remix/test';

import { clients, organizationMemberships } from '../../../data/db.ts';
import { testDb as db, clearTestTables } from '../../../../test/db-setup.ts';
import { createAppRouter } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  extractCsrf,
  getHtml,
  origin,
  postForm,
  submitForm,
} from '../../../../test/http.ts';

const router = createAppRouter({ db });

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function clientItemCount(html: string) {
  return html.match(/<li\b/g)?.length ?? 0;
}

async function createTenant(prefix: string) {
  return createUserAndLoginWithOrganization(router, prefix);
}

async function createClient(
  sessionCookie: string,
  fields: Record<string, string>,
): Promise<{ id: string; location: string }> {
  let response = await postForm(
    router,
    routes.app.clients.create.href(),
    fields,
    sessionCookie,
  );
  assert.equal(response.status, 302, 'a valid Client should be created');
  let location = response.headers.get('Location');
  assert.ok(location, 'create should redirect to the profile');
  let client = await db.findOne(clients, { where: { legal_name: fields.legal_name } });
  assert.ok(client, 'the Client should be persisted');
  return { id: client.id, location };
}

async function seedClient(
  organizationId: string,
  legalName: string,
  status: 'active' | 'archived' = 'active',
) {
  let now = Date.now();
  await db.create(clients, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    type: 'business',
    legal_name: legalName,
    status,
    archived_at: status === 'archived' ? now : null,
    created_at: now,
    updated_at: now,
  });
}

beforeEach(async () => {
  await clearTestTables(clients);
});

describe('Client Organization isolation', () => {
  it('scopes directory listing, search, and type filters to the current Organization', async () => {
    let first = await createTenant('client-isolation-first');
    let second = await createTenant('client-isolation-second');
    let firstName = uniqueName('First Organization Individual');
    let secondName = uniqueName('Second Organization Business');

    await createClient(first.sessionCookie, { type: 'individual', legal_name: firstName });
    await createClient(second.sessionCookie, { type: 'business', legal_name: secondName });
    for (let number = 0; number < 20; number += 1) {
      await seedClient(
        second.organizationId,
        `Zulu Other Organization Business ${String(number).padStart(2, '0')}`,
      );
    }
    let archivedName = uniqueName('Zulu Archived Organization Client');
    await seedClient(second.organizationId, archivedName, 'archived');

    let firstDirectory = await getHtml(
      router,
      routes.app.clients.index.href(),
      first.sessionCookie,
    );
    assert.match(firstDirectory, new RegExp(firstName));
    assert.doesNotMatch(firstDirectory, new RegExp(secondName));
    assert.equal(clientItemCount(firstDirectory), 1);
    assert.doesNotMatch(firstDirectory, />Next<\/a>/);

    let firstSearch = await getHtml(
      router,
      routes.app.clients.index.href({}, { searchParams: { q: secondName } }),
      first.sessionCookie,
    );
    assert.match(firstSearch, /No clients match your search and filters\./);
    assert.equal(clientItemCount(firstSearch), 0);

    let firstBusinesses = await getHtml(
      router,
      routes.app.clients.index.href({}, { searchParams: { type: 'business' } }),
      first.sessionCookie,
    );
    assert.match(firstBusinesses, /No clients match your search and filters\./);
    assert.equal(clientItemCount(firstBusinesses), 0);

    let secondDirectory = await getHtml(
      router,
      routes.app.clients.index.href(),
      second.sessionCookie,
    );
    assert.match(secondDirectory, new RegExp(secondName));
    assert.doesNotMatch(secondDirectory, new RegExp(firstName));
    assert.equal(clientItemCount(secondDirectory), 20);
    assert.match(secondDirectory, />Next<\/a>/);

    let firstArchived = await getHtml(
      router,
      routes.app.clients.index.href({}, { searchParams: { status: 'archived' } }),
      first.sessionCookie,
    );
    assert.match(firstArchived, /No archived clients\./);
    assert.equal(clientItemCount(firstArchived), 0);

    let secondArchived = await getHtml(
      router,
      routes.app.clients.index.href({}, { searchParams: { status: 'archived' } }),
      second.sessionCookie,
    );
    assert.match(secondArchived, new RegExp(archivedName));

    assert.notEqual(first.organizationId, second.organizationId);
  });

  it('hides foreign Client details and rejects edit, archive, and restore by identifier', async () => {
    let owner = await createTenant('client-owner');
    let other = await createTenant('client-other');
    let legalName = uniqueName('Private Business');
    let secretAddress = uniqueName('Private address');
    let secretTaxValue = `GB${crypto.randomUUID().replaceAll('-', '').slice(0, 9).toUpperCase()}`;
    let { id, location } = await createClient(owner.sessionCookie, {
      type: 'business',
      legal_name: legalName,
      billing_line1: secretAddress,
      billing_country: 'GB',
      tax_country: 'GB',
      tax_type: 'VAT',
      tax_value: secretTaxValue,
    });

    let ownerProfile = await getHtml(router, location, owner.sessionCookie);
    assert.match(ownerProfile, new RegExp(secretAddress));
    assert.match(ownerProfile, new RegExp(secretTaxValue));

    let foreignProfile = await router.fetch(new URL(location, origin), {
      headers: { Cookie: other.sessionCookie },
    });
    assert.equal(foreignProfile.status, 404);
    let foreignBody = await foreignProfile.text();
    assert.match(foreignBody, /Client not found/);
    assert.doesNotMatch(foreignBody, new RegExp(legalName));
    assert.doesNotMatch(foreignBody, new RegExp(secretAddress));
    assert.doesNotMatch(foreignBody, new RegExp(secretTaxValue));

    let foreignEditPage = await router.fetch(
      new URL(routes.app.clients.edit.href({ clientId: id }), origin),
      { headers: { Cookie: other.sessionCookie } },
    );
    assert.equal(foreignEditPage.status, 404);

    let foreignEdit = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.update.href({ clientId: id }),
      {
        _method: 'PUT',
        type: 'business',
        legal_name: uniqueName('Tampered Business'),
        billing_line1: uniqueName('Tampered address'),
        tax_country: 'GB',
        tax_type: 'VAT',
        tax_value: 'GB999999999',
      },
      other.sessionCookie,
    );
    assert.equal(foreignEdit.status, 404);
    assert.equal((await db.find(clients, id))?.legal_name, legalName);
    assert.equal((await db.find(clients, id))?.billing_line1, secretAddress);
    assert.equal((await db.find(clients, id))?.tax_value, secretTaxValue);

    let foreignArchive = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.archive.href({ clientId: id }),
      { _method: 'PUT' },
      other.sessionCookie,
    );
    assert.equal(foreignArchive.status, 404);
    assert.equal((await db.find(clients, id))?.status, 'active');

    let ownerArchive = await submitForm(
      router,
      location,
      routes.app.clients.lifecycle.archive.href({ clientId: id }),
      { _method: 'PUT' },
      owner.sessionCookie,
    );
    assert.equal(ownerArchive.status, 302);
    assert.equal((await db.find(clients, id))?.status, 'archived');

    let foreignRestore = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.restore.href({ clientId: id }),
      { _method: 'PUT' },
      other.sessionCookie,
    );
    assert.equal(foreignRestore.status, 404);
    assert.equal((await db.find(clients, id))?.status, 'archived');

    let ownerRestore = await submitForm(
      router,
      location,
      routes.app.clients.lifecycle.restore.href({ clientId: id }),
      { _method: 'PUT' },
      owner.sessionCookie,
    );
    assert.equal(ownerRestore.status, 302);
    assert.equal((await db.find(clients, id))?.status, 'active');
  });

  it('ignores forged Organization IDs and does not reveal cross-Organization tax matches', async () => {
    let owner = await createTenant('client-forged-owner');
    let other = await createTenant('client-forged-other');
    let taxValue = 'GB222222222';
    let originalName = uniqueName('Owner Client');
    let created = await postForm(
      router,
      routes.app.clients.create.href(),
      {
        type: 'business',
        legal_name: originalName,
        organization_id: other.organizationId,
        tax_country: 'GB',
        tax_type: 'VAT',
        tax_value: taxValue,
      },
      owner.sessionCookie,
    );
    assert.equal(created.status, 302);
    let original = await db.findOne(clients, { where: { legal_name: originalName } });
    assert.ok(original);
    assert.equal(original.organization_id, owner.organizationId);

    let updatedName = uniqueName('Renamed Owner Client');
    let edited = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: original.id }),
      routes.app.clients.update.href({ clientId: original.id }),
      {
        _method: 'PUT',
        type: 'business',
        legal_name: updatedName,
        organization_id: other.organizationId,
        tax_country: 'GB',
        tax_type: 'VAT',
        tax_value: taxValue,
      },
      owner.sessionCookie,
    );
    assert.equal(edited.status, 302);
    let updated = await db.find(clients, original.id);
    assert.equal(updated?.legal_name, updatedName);
    assert.equal(updated?.organization_id, owner.organizationId);

    let otherName = uniqueName('Other Organization Client');
    let otherCreated = await postForm(
      router,
      routes.app.clients.create.href(),
      {
        type: 'individual',
        legal_name: otherName,
        organization_id: owner.organizationId,
        tax_country: 'GB',
        tax_type: 'VAT',
        tax_value: taxValue,
      },
      other.sessionCookie,
    );
    assert.equal(otherCreated.status, 302);
    let otherLocation = otherCreated.headers.get('Location');
    assert.ok(otherLocation);
    let otherProfile = await getHtml(router, otherLocation, other.sessionCookie);
    assert.match(otherProfile, /Client created/);
    assert.doesNotMatch(otherProfile, /already recorded on another client/);
    let otherClient = await db.findOne(clients, { where: { legal_name: otherName } });
    assert.equal(otherClient?.organization_id, other.organizationId);

    let foreignProfile = await router.fetch(
      new URL(routes.app.clients.show.href({ clientId: original.id }), origin),
      { headers: { Cookie: other.sessionCookie } },
    );
    assert.equal(foreignProfile.status, 404);
  });

  it('fails closed across Client route maps when the User has no OrganizationMembership', async () => {
    let tenant = await createTenant('client-no-membership');
    let legalName = uniqueName('Membership Required Client');
    let { id } = await createClient(tenant.sessionCookie, {
      type: 'individual',
      legal_name: legalName,
    });
    let newPage = await getHtml(
      router,
      routes.app.clients.new.href(),
      tenant.sessionCookie,
    );
    let csrf = extractCsrf(newPage);
    assert.ok(csrf);

    let membership = await db.findOne(organizationMemberships, {
      where: { organization_id: tenant.organizationId },
    });
    assert.ok(membership);
    await db.delete(organizationMemberships, membership.id);

    for (let path of [
      routes.app.clients.index.href(),
      routes.app.clients.new.href(),
      routes.app.clients.show.href({ clientId: id }),
      routes.app.clients.edit.href({ clientId: id }),
    ]) {
      let response = await router.fetch(new URL(path, origin), {
        headers: { Cookie: tenant.sessionCookie },
      });
      assert.equal(response.status, 403, `${path} should deny missing Organization context`);
    }

    for (let path of [
      routes.app.clients.create.href(),
      routes.app.clients.update.href({ clientId: id }),
      routes.app.clients.lifecycle.archive.href({ clientId: id }),
      routes.app.clients.lifecycle.restore.href({ clientId: id }),
    ]) {
      let body = new URLSearchParams({
        _csrf: csrf,
        type: 'individual',
        legal_name: uniqueName('Must Not Be Created'),
      });
      if (path !== routes.app.clients.create.href()) body.set('_method', 'PUT');
      let response = await router.fetch(new URL(path, origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: tenant.sessionCookie,
        },
        body: body.toString(),
      });
      assert.equal(response.status, 403, `${path} should deny missing Organization context`);
    }

    assert.equal((await db.find(clients, id))?.status, 'active');
    assert.equal((await db.find(clients, id))?.legal_name, legalName);
  });
});
