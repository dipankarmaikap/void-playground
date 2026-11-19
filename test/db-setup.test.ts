import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients, organizations, users } from '../app/data/db.ts';
import { testDb as db, clearTestTables } from './db-setup.ts';

function createCleanupClient(organizationId: string) {
  let now = Date.now();
  return db.create(clients, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    type: 'individual',
    legal_name: `Cleanup Client ${crypto.randomUUID()}`,
    status: 'active',
    archived_at: null,
    created_at: now,
    updated_at: now,
  });
}

describe('shared test database cleanup', () => {
  it('removes every row from exactly the named tables', async () => {
    let userId = crypto.randomUUID();
    await db.create(users, {
      id: userId,
      email: `cleanup-${crypto.randomUUID()}@example.com`,
      email_verified: true,
      created_at: Date.now(),
    });
    let organizationId = crypto.randomUUID();
    await db.create(organizations, {
      id: organizationId,
      name: 'Cleanup Organization',
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    await createCleanupClient(organizationId);
    await createCleanupClient(organizationId);

    await clearTestTables(clients);

    assert.equal((await db.findMany(clients)).length, 0);
    assert.ok(await db.find(users, userId), 'an unnamed table must keep its rows');
    assert.ok(
      await db.find(organizations, organizationId),
      'an unnamed table must keep its rows',
    );
  });

  it('is a safe no-op on an already-empty table', async () => {
    await clearTestTables(clients);

    assert.equal((await db.findMany(clients)).length, 0);
  });
});
