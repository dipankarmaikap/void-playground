import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../router.ts';
import { routes } from '../routes.ts';
import { db, users, userPasswords, sessions } from '../data/db.ts';
import { hashPassword } from '../data/password.ts';

function extractCsrf(html: string): string {
  let m = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
  if (!m) m = html.match(/value="([^"]+)"[^>]*name="_csrf"/);
  return m ? m[1] : '';
}

function cookieFromResponse(res: Response): string {
  let sc = res.headers.get('Set-Cookie');
  if (!sc) return '';
  return sc.split(';')[0];
}

describe('session flow', () => {
  it('login, view settings, revoke other session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let password = 'password123';
    let userId = crypto.randomUUID();
    await db.create(users, { id: userId, email, email_verified: true, created_at: Date.now() });
    await db.create(userPasswords, { user_id: userId, password_hash: hashPassword(password), updated_at: Date.now() });

    // create a second "other" session row for same user
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

    // GET login page for csrf
    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));
    assert.equal(loginPage.status, 200);
    let loginHtml = await loginPage.text();
    let csrf = extractCsrf(loginHtml);
    assert.ok(csrf);

    // POST login
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
    // login redirects to dashboard
    assert.equal(loginRes.status, 302);
    let sessionCookie = cookieFromResponse(loginRes);
    assert.ok(sessionCookie);

    // GET settings
    let settingsRes = await router.fetch(new URL(routes.app.settings.index.href(), 'http://localhost'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(settingsRes.status, 200);
    let settingsHtml = await settingsRes.text();
    assert.match(settingsHtml, /Logged-in sessions/);
    assert.match(settingsHtml, /1\.2\.3\.4/);

    // revoke other session
    let revokeBody = new URLSearchParams();
    revokeBody.set('_csrf', extractCsrf(settingsHtml));
    revokeBody.set('action', 'revoke');
    revokeBody.set('session_id', otherSessionId);
    // need csrf from settings page
    // re-extract already done
    let revokeRes = await router.fetch(new URL(routes.app.settings.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: revokeBody.toString(),
    });
    assert.equal(revokeRes.status, 302);

    // other session row deleted
    let row = await db.find(sessions, otherSessionId);
    assert.equal(row, null);
  });
});