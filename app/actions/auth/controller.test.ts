import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';
import { db, users, userPasswords } from '../../data/db.ts';
import { hashPassword } from '../../data/password.ts';

function cookieFromResponse(res: Response): string {
  let sc = res.headers.get('Set-Cookie');
  if (!sc) return '';
  return sc.split(';')[0];
}

describe('auth controller', () => {
  it('GET /login returns the login page', async () => {
    let response = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });

  it('GET /register returns the register page', async () => {
    let response = await router.fetch(
      new URL(routes.auth.register.index.href(), 'http://localhost'),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });

  it('GET /login redirects authenticated users to /app/dashboard', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let userId = crypto.randomUUID();
    await db.create(users, { id: userId, email, email_verified: true, created_at: Date.now() });
    await db.create(userPasswords, { user_id: userId, password_hash: hashPassword('password123'), updated_at: Date.now() });

    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));
    let csrfMatch = (await loginPage.text()).match(/name="_csrf"[^>]*value="([^"]+)"/);
    let csrf = csrfMatch ? csrfMatch[1] : '';
    let body = new URLSearchParams({ email, password: 'password123', _csrf: csrf });
    let loginRes = await router.fetch(new URL(routes.auth.login.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieFromResponse(loginPage) },
      body: body.toString(),
    });
    let sessionCookie = cookieFromResponse(loginRes);

    let response = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/app/dashboard');
  });

  it('GET /register redirects authenticated users to /app/dashboard', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let userId = crypto.randomUUID();
    await db.create(users, { id: userId, email, email_verified: true, created_at: Date.now() });
    await db.create(userPasswords, { user_id: userId, password_hash: hashPassword('password123'), updated_at: Date.now() });

    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));
    let csrfMatch = (await loginPage.text()).match(/name="_csrf"[^>]*value="([^"]+)"/);
    let csrf = csrfMatch ? csrfMatch[1] : '';
    let body = new URLSearchParams({ email, password: 'password123', _csrf: csrf });
    let loginRes = await router.fetch(new URL(routes.auth.login.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieFromResponse(loginPage) },
      body: body.toString(),
    });
    let sessionCookie = cookieFromResponse(loginRes);

    let response = await router.fetch(new URL(routes.auth.register.index.href(), 'http://localhost'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/app/dashboard');
  });
});