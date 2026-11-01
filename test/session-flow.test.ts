import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { db, users, userPasswords, sessions } from '../app/data/db.ts';
import { hashPassword } from '../app/data/password.ts';

import { cookieFromResponse, extractCsrf } from './http.ts';

describe('session flow', () => {
  it('login, view settings, revoke other session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let password = 'password123';
    let userId = crypto.randomUUID();
    await db.create(users, { id: userId, email, email_verified: true, created_at: Date.now() });
    await db.create(userPasswords, { user_id: userId, password_hash: hashPassword(password), updated_at: Date.now() });

    let otherSessionId = crypto.randomUUID();
    await db.create(sessions, {
      id: otherSessionId,
      user_id: userId,
      data: JSON.stringify([{ auth: { userId } }, {}]),
      ip: '1.2.3.4',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/1.0',
      created_at: Date.now(),
      last_active_at: Date.now(),
    });

    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));
    assert.equal(loginPage.status, 200);
    let loginHtml = await loginPage.text();
    let csrf = extractCsrf(loginHtml);
    assert.ok(csrf);

    let body = new URLSearchParams();
    body.set('email', email);
    body.set('password', password);
    body.set('_csrf', csrf);
    let loginRes = await router.fetch(new URL(routes.auth.login.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieFromResponse(loginPage),
      },
      body: body.toString(),
    });
    assert.equal(loginRes.status, 302);
    let sessionCookie = cookieFromResponse(loginRes);
    assert.ok(sessionCookie);

    let settingsRes = await router.fetch(new URL(routes.app.settings.index.href(), 'http://localhost'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(settingsRes.status, 200);
    let settingsHtml = await settingsRes.text();
    assert.match(settingsHtml, /Logged-in sessions/);
    assert.match(settingsHtml, /1\.2\.3\.4/);

    let revokeBody = new URLSearchParams();
    revokeBody.set('_csrf', extractCsrf(settingsHtml));
    revokeBody.set('action', 'revoke');
    revokeBody.set('session_id', otherSessionId);
    let revokeRes = await router.fetch(new URL(routes.app.settings.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: revokeBody.toString(),
    });
    assert.equal(revokeRes.status, 302);

    let row = await db.find(sessions, otherSessionId);
    assert.equal(row, null);
  });
});