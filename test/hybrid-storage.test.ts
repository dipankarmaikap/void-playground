import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { db, sessions } from '../app/data/db.ts';
import { hashPassword } from '../app/data/password.ts';
import { users, userPasswords } from '../app/data/db.ts';

import { cookieFromResponse, extractCsrf } from './http.ts';

describe('hybrid storage', () => {
  it('anonymous visits create no DB session rows', async () => {
    let before = await db.count(sessions, {});
    let res = await router.fetch(new URL(routes.auth.register.index.href(), 'http://localhost'));
    assert.equal(res.status, 200);
    let after = await db.count(sessions, {});
    assert.equal(after, before, 'anonymous GET /register must not create a DB row');
  });

  it('authenticated login creates exactly one DB row', async () => {
    let email = `h-${crypto.randomUUID()}@example.com`;
    let userId = crypto.randomUUID();
    await db.create(users, { id: userId, email, email_verified: true, created_at: Date.now() });
    await db.create(userPasswords, { user_id: userId, password_hash: hashPassword('password123'), updated_at: Date.now() });

    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));
    let csrf = extractCsrf(await loginPage.text());
    let body = new URLSearchParams({ email, password: 'password123', _csrf: csrf });
    let loginRes = await router.fetch(new URL(routes.auth.login.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieFromResponse(loginPage) },
      body: body.toString(),
    });
    assert.equal(loginRes.status, 302);
    let sc = cookieFromResponse(loginRes);
    assert.ok(sc);

    let userRows = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(userRows.length, 1);

    let settingsRes = await router.fetch(new URL(routes.app.settings.index.href(), 'http://localhost'), {
      headers: { Cookie: sc },
    });
    assert.equal(settingsRes.status, 200);
  });
});