import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { db, users } from '../app/data/db.ts';

import { cookieFromResponse, extractCsrf, login, origin } from './http.ts';

async function register(body: Record<string, string>) {
  let page = await router.fetch(new URL(routes.auth.register.index.href(), origin));
  let csrf = extractCsrf(await page.text());
  let response = await router.fetch(new URL(routes.auth.register.action.href(), origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieFromResponse(page),
    },
    body: new URLSearchParams({ ...body, _csrf: csrf }).toString(),
  });
  return { response, html: await response.text() };
}

describe('auth flow', () => {
  it('registers, verifies, and logs in', async () => {
    let email = `Flow-${crypto.randomUUID()}@Example.com`;
    let normalizedEmail = email.trim().toLowerCase();
    let password = 'password123';

    let registerPage = await router.fetch(new URL(routes.auth.register.index.href(), origin));
    let csrf = extractCsrf(await registerPage.text());
    let registerResponse = await router.fetch(
      new URL(routes.auth.register.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieFromResponse(registerPage),
        },
        body: new URLSearchParams({ email, password, _csrf: csrf }).toString(),
      },
    );
    assert.equal(registerResponse.status, 302);
    assert.equal(registerResponse.headers.get('Location'), routes.auth.login.index.href());

    let user = await db.findOne(users, { where: { email: normalizedEmail } });
    assert.ok(user, 'registration should normalize the email');
    assert.ok(user.verification_token);
    assert.equal(user.email_verified, false);

    let afterRegister = await router.fetch(new URL(routes.auth.login.index.href(), origin), {
      headers: { Cookie: cookieFromResponse(registerResponse) },
    });
    assert.match(
      await afterRegister.text(),
      /<p role="status"[^>]*>Check your email to verify your account<\/p>/,
    );

    let verifyUrl = new URL(routes.auth.verify.href(), origin);
    verifyUrl.searchParams.set('token', user.verification_token);
    let verifyResponse = await router.fetch(verifyUrl);
    assert.equal(verifyResponse.status, 302);
    assert.equal(verifyResponse.headers.get('Location'), routes.auth.login.index.href());

    let verified = await db.find(users, user.id);
    assert.equal(verified?.email_verified, true);
    assert.equal(verified?.verification_token, null);

    let afterVerify = await router.fetch(new URL(routes.auth.login.index.href(), origin), {
      headers: { Cookie: cookieFromResponse(verifyResponse) },
    });
    assert.match(
      await afterVerify.text(),
      /<p role="status"[^>]*>Email verified\. You can now log in\.<\/p>/,
    );

    let sessionCookie = await login(router, normalizedEmail, password);
    let dashboard = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Welcome back/);
  });

  it('registers with a trimmed display name', async () => {
    let email = `named-${crypto.randomUUID()}@example.com`;
    let { response } = await register({
      email,
      password: 'password123',
      display_name: '  Ada Lovelace  ',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let user = await db.findOne(users, { where: { email } });
    assert.equal(user?.display_name, 'Ada Lovelace');
    assert.ok(user?.verification_token);
    assert.equal(user?.email_verified, false);
  });

  it('registers without a display name', async () => {
    let email = `unnamed-${crypto.randomUUID()}@example.com`;
    let { response } = await register({ email, password: 'password123' });

    assert.equal(response.status, 302);

    let user = await db.findOne(users, { where: { email } });
    assert.equal(user?.display_name, null);
  });

  it('treats a whitespace-only display name as unset', async () => {
    let email = `blank-${crypto.randomUUID()}@example.com`;
    let { response } = await register({
      email,
      password: 'password123',
      display_name: '   ',
    });

    assert.equal(response.status, 302);

    let user = await db.findOne(users, { where: { email } });
    assert.equal(user?.display_name, null);
  });

  it('rejects a display name longer than 80 characters', async () => {
    let email = `long-${crypto.randomUUID()}@example.com`;
    let displayName = 'x'.repeat(81);
    let { response, html } = await register({
      email,
      password: 'password123',
      display_name: displayName,
    });

    assert.equal(response.status, 400);
    assert.match(html, /80 characters/);
    assert.match(html, new RegExp(email));
    assert.match(html, /name="display_name"[^>]*value="x{81}"/);
    assert.equal(await db.findOne(users, { where: { email } }), null);

    // The normal email/password/verification flow still works after the error.
    let retry = await register({ email, password: 'password123' });
    assert.equal(retry.response.status, 302);
    let user = await db.findOne(users, { where: { email } });
    assert.ok(user?.verification_token);
  });

  it('renders the register form with a validation error', async () => {
    let registerPage = await router.fetch(new URL(routes.auth.register.index.href(), origin));
    let csrf = extractCsrf(await registerPage.text());
    let response = await router.fetch(new URL(routes.auth.register.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieFromResponse(registerPage),
      },
      body: new URLSearchParams({
        email: 'not-an-email',
        password: 'password123',
        _csrf: csrf,
      }).toString(),
    });

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Expected valid email/);
  });
});
