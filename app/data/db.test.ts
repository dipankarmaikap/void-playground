import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import {
  clients,
  db,
  organizationMemberships,
  organizations,
  users,
  userPasswords,
  assertOrganizationSchemaCompatible,
} from './db.ts';

async function createUser(): Promise<string> {
  let id = crypto.randomUUID();
  await db.create(users, {
    id,
    email: `user-${crypto.randomUUID()}@example.com`,
    email_verified: true,
    created_at: Date.now(),
  });
  return id;
}

async function createOrganization(name: string): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(organizations, {
    id,
    name,
    created_at: now,
    updated_at: now,
  });
  return id;
}

describe('db', () => {
  it('creates and reads a user without password hash', async () => {
    let id = crypto.randomUUID();
    let email = `user-${crypto.randomUUID()}@example.com`;
    await db.create(users, { id, email, email_verified: false, created_at: Date.now() });
    await db.create(userPasswords, { user_id: id, password_hash: 'hash', updated_at: Date.now() });
    let user = await db.find(users, id);
    assert.ok(user);
    assert.equal(user.email, email);
    assert.equal('password_hash' in user, false);
  });

  it('allows different Organizations to use the same name', async () => {
    let first = await createOrganization('Same Name Studio');
    let second = await createOrganization('Same Name Studio');

    assert.notEqual(first, second);
    assert.equal((await db.find(organizations, first))?.name, 'Same Name Studio');
    assert.equal((await db.find(organizations, second))?.name, 'Same Name Studio');
  });

  it('enforces Organization names and membership integrity in SQLite', async () => {
    let invalidOrganizationId = crypto.randomUUID();
    let blankNameRejected = false;
    try {
      await db.create(organizations, {
        id: invalidOrganizationId,
        name: '   ',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      blankNameRejected = true;
    }
    assert.equal(blankNameRejected, true);
    assert.equal(await db.find(organizations, invalidOrganizationId), null);

    let whitespaceOrganizationId = crypto.randomUUID();
    let whitespaceNameRejected = false;
    try {
      await db.create(organizations, {
        id: whitespaceOrganizationId,
        name: ' \t\r\n ',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      whitespaceNameRejected = true;
    }
    assert.equal(whitespaceNameRejected, true);
    assert.equal(await db.find(organizations, whitespaceOrganizationId), null);

    let userId = await createUser();
    let otherUserId = await createUser();
    let organizationId = await createOrganization('Membership Test Studio');
    let membership = {
      organization_id: organizationId,
      user_id: userId,
      is_owner: true,
      created_at: Date.now(),
    };
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      ...membership,
    });

    let duplicateMembershipRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        ...membership,
      });
    } catch {
      duplicateMembershipRejected = true;
    }
    assert.equal(duplicateMembershipRejected, true);

    let secondOwnerRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        ...membership,
        user_id: otherUserId,
      });
    } catch {
      secondOwnerRejected = true;
    }
    assert.equal(secondOwnerRejected, true);

    let invalidOrganizationMembershipRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        organization_id: crypto.randomUUID(),
        user_id: otherUserId,
        is_owner: false,
        created_at: Date.now(),
      });
    } catch {
      invalidOrganizationMembershipRejected = true;
    }
    assert.equal(invalidOrganizationMembershipRejected, true);
  });

  it('rejects incompatible existing identity data without deleting it', async () => {
    let id = await createUser();
    let rejected = false;
    let message = '';

    try {
      await assertOrganizationSchemaCompatible();
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }

    assert.equal(rejected, true);
    assert.match(message, /operator-managed clean start/);
    assert.ok(await db.find(users, id));

    for (let user of await db.findMany(users)) {
      let membership = await db.findOne(organizationMemberships, {
        where: { user_id: user.id },
      });
      if (membership) continue;

      let organizationId = await createOrganization(`Compatibility ${crypto.randomUUID()}`);
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        user_id: user.id,
        is_owner: true,
        created_at: Date.now(),
      });
    }
    await assertOrganizationSchemaCompatible();

    let clientId = crypto.randomUUID();
    let now = Date.now();
    await db.create(clients, {
      id: clientId,
      type: 'individual',
      legal_name: 'Legacy Client',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    let legacyClientRejected = false;
    try {
      await assertOrganizationSchemaCompatible();
    } catch (error) {
      legacyClientRejected =
        error instanceof Error && /operator-managed clean start/.test(error.message);
    }
    assert.equal(legacyClientRejected, true);
    assert.ok(await db.find(clients, clientId));
  });
});
