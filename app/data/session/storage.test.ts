import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { sessions, users } from '../db.ts';
import { createHybridSessionStorage, SESSION_TTL_MS } from './storage.ts';
import { testDb as db } from '../../../test/db-setup.ts';

async function createUser() {
  let id = crypto.randomUUID();
  await db.create(users, {
    id,
    email: `${id}@example.com`,
    email_verified: true,
    verification_token: null,
    verification_expires_at: null,
    created_at: Date.now(),
  });
  return id;
}

describe('hybrid session storage', () => {
  it('drops a session row past the TTL', async () => {
    let userId = await createUser();
    let id = crypto.randomUUID();
    let expiredAt = Date.now() - SESSION_TTL_MS - 1000;
    await db.create(sessions, {
      id,
      user_id: userId,
      data: JSON.stringify([{ auth: { userId } }, {}]),
      ip: null,
      user_agent: null,
      created_at: expiredAt,
      last_active_at: expiredAt,
    });

    let storage = createHybridSessionStorage(db);
    let session = await storage.read(`db:${id}`);

    assert.equal(session.get('auth'), undefined);
    assert.equal(await db.find(sessions, id), null);
  });

  it('reads an active session row', async () => {
    let userId = await createUser();
    let id = crypto.randomUUID();
    await db.create(sessions, {
      id,
      user_id: userId,
      data: JSON.stringify([{ auth: { userId } }, {}]),
      ip: null,
      user_agent: null,
      created_at: Date.now(),
      last_active_at: Date.now(),
    });

    let storage = createHybridSessionStorage(db);
    let session = await storage.read(`db:${id}`);
    let auth = session.get('auth') as { userId: string } | undefined;

    assert.equal(auth?.userId, userId);
  });
});
