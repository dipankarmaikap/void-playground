import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { db, sessions } from '../app/data/db.ts';
import './db-setup.ts';

import { createUser, login, origin } from './http.ts';

describe('hybrid storage', () => {
  it('anonymous visits create no DB session rows', async () => {
    let before = await db.count(sessions, {});
    let res = await router.fetch(new URL(routes.auth.register.index.href(), origin));
    assert.equal(res.status, 200);
    let after = await db.count(sessions, {});
    assert.equal(after, before, 'anonymous GET /register must not create a DB row');
  });

  it('authenticated login creates exactly one DB row', async () => {
    let email = `h-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');

    let sessionCookie = await login(router, email, 'password123');

    let userRows = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(userRows.length, 1);

    let settingsRes = await router.fetch(
      new URL(routes.app.settings.sessions.index.href(), origin),
      {
        headers: { Cookie: sessionCookie },
      },
    );
    assert.equal(settingsRes.status, 200);
  });
});
