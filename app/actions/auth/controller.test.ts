import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createTestRouter } from '../../../test/router.ts';
import { routes } from '../../routes.ts';
import {
  organizationMemberships,
  organizations,
  users,
} from '../../data/db.ts';
import {
  cookieFromResponse,
  createUser,
  extractCsrf,
  login,
  origin,
  submitForm,
} from '../../../test/http.ts';

const { router, db } = await createTestRouter();

const base = origin;

describe('auth controller', () => {
  it('GET /login returns the login page', async () => {
    let response = await router.fetch(new URL(routes.auth.login.index.href(), base));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });

  it('GET /register returns the register page', async () => {
    let response = await router.fetch(new URL(routes.auth.register.index.href(), base));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });

  it('GET /login renders a branded card with metadata and a link to registration', async () => {
    let response = await router.fetch(new URL(routes.auth.login.index.href(), base));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>Log in \| My Remix App<\/title>/);
    assert.match(
      html,
      /<meta name="description" content="Log in to My Remix App to open your dashboard\."/,
    );
    assert.doesNotMatch(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<a[^>]*href="\/"[^>]*>My Remix App<\/a>/);
    assert.match(html, /<form[^>]*method="post"[^>]*action="\/login"/);
    assert.match(html, /name="_csrf"/);
    assert.match(html, /<a[^>]*href="\/register"[^>]*>Register<\/a>/);
  });

  it('GET /register renders a branded card with metadata and a link to login', async () => {
    let response = await router.fetch(new URL(routes.auth.register.index.href(), base));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>Register \| My Remix App<\/title>/);
    assert.match(
      html,
      /<meta name="description" content="Register with My Remix App and create your Organization\."/,
    );
    assert.doesNotMatch(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<a[^>]*href="\/"[^>]*>My Remix App<\/a>/);
    assert.match(html, /<form[^>]*method="post"[^>]*action="\/register"/);
    assert.match(html, /name="_csrf"/);
    assert.match(html, /name="organization_name"[^>]*required/);
    assert.match(html, /<a[^>]*href="\/login"[^>]*>Log in<\/a>/);
  });

  it('gives login and registration distinct titles and descriptions', async () => {
    let loginHtml = await (
      await router.fetch(new URL(routes.auth.login.index.href(), base))
    ).text();
    let registerHtml = await (
      await router.fetch(new URL(routes.auth.register.index.href(), base))
    ).text();

    let readTitle = (html: string) => /<title>([^<]+)<\/title>/.exec(html)?.[1];
    let readDescription = (html: string) =>
      /<meta name="description" content="([^"]+)"/.exec(html)?.[1];

    assert.ok(readTitle(loginHtml));
    assert.ok(readTitle(registerHtml));
    assert.notEqual(readTitle(loginHtml), readTitle(registerHtml));
    assert.ok(readDescription(loginHtml));
    assert.ok(readDescription(registerHtml));
    assert.notEqual(readDescription(loginHtml), readDescription(registerHtml));
  });

  it('GET /login redirects authenticated users to the dashboard', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    await createUser(db, email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let response = await router.fetch(new URL(routes.auth.login.index.href(), base), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.dashboard.href());
  });

  it('GET /register redirects authenticated users to the dashboard', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    await createUser(db, email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let response = await router.fetch(new URL(routes.auth.register.index.href(), base), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.dashboard.href());
  });

  it('rejects login for an unverified user', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    await createUser(db, email, 'password123', false);

    let page = await router.fetch(new URL(routes.auth.login.index.href(), base));
    let csrf = extractCsrf(await page.text());
    let response = await router.fetch(new URL(routes.auth.login.action.href(), base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieFromResponse(page),
      },
      body: new URLSearchParams({ email, password: 'password123', _csrf: csrf }).toString(),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let followUp = await router.fetch(new URL(routes.auth.login.index.href(), base), {
      headers: { Cookie: cookieFromResponse(response) },
    });
    assert.match(
      await followUp.text(),
      /<p role="alert"[^>]*>Invalid email or password<\/p>/,
    );
  });

  it('rejects a login POST without a CSRF token', async () => {
    let response = await router.fetch(new URL(routes.auth.login.action.href(), base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'nobody@example.com', password: 'password123' }).toString(),
    });
    assert.equal(response.status, 403);
  });

  it('does not verify a user with an expired token', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() - 1000,
    });

    let verifyUrl = new URL(routes.auth.verify.index.href(), base);
    verifyUrl.searchParams.set('token', token);
    let response = await router.fetch(verifyUrl);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, false);
  });

  it('renders a verification form for a valid link without changing the User', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() + 60_000,
    });

    let verifyUrl = new URL(routes.auth.verify.index.href(), base);
    verifyUrl.searchParams.set('token', token);
    let response = await router.fetch(verifyUrl);
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<form[^>]*method="post"[^>]*action="\/verify"/);
    assert.match(html, new RegExp(`name="token"[^>]*value="${token}"`));
    assert.match(html, /name="_csrf"/);

    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, false);
    assert.equal(user?.verification_token, token);
  });

  it('verifies a User only after a valid verification POST', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() + 60_000,
    });

    let verifyUrl = new URL(routes.auth.verify.index.href(), base);
    verifyUrl.searchParams.set('token', token);
    let response = await submitForm(
      router,
      verifyUrl.href,
      routes.auth.verify.action.href(),
      { token },
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, true);
    assert.equal(user?.verification_token, null);
    assert.equal(user?.verification_expires_at, null);
  });

  it('rejects invalid and expired verification POSTs with accessible feedback', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() - 1000,
    });

    for (let invalidToken of ['not-a-token', token]) {
      let response = await submitForm(
        router,
        routes.auth.login.index.href(),
        routes.auth.verify.action.href(),
        { token: invalidToken },
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

      let followUp = await router.fetch(
        new URL(routes.auth.login.index.href(), base),
        { headers: { Cookie: cookieFromResponse(response) } },
      );
      assert.match(await followUp.text(), /<p role="alert"[^>]*>Invalid or expired verification link<\/p>/);
    }

    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, false);
    assert.equal(user?.verification_token, token);
  });

  it('rejects a reused verification token without changing the verified User', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() + 60_000,
    });

    let verifyUrl = new URL(routes.auth.verify.index.href(), base);
    verifyUrl.searchParams.set('token', token);
    let first = await submitForm(
      router,
      verifyUrl.href,
      routes.auth.verify.action.href(),
      { token },
    );
    assert.equal(first.status, 302);

    let reused = await submitForm(
      router,
      routes.auth.login.index.href(),
      routes.auth.verify.action.href(),
      { token },
    );
    assert.equal(reused.status, 302);
    let followUp = await router.fetch(
      new URL(routes.auth.login.index.href(), base),
      { headers: { Cookie: cookieFromResponse(reused) } },
    );
    assert.match(await followUp.text(), /<p role="alert"[^>]*>Invalid or expired verification link<\/p>/);

    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, true);
    assert.equal(user?.verification_token, null);
  });

  it('rejects Email Verification without a CSRF token', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let token = crypto.randomUUID();
    let userId = await createUser(db, email, 'password123', false);
    await db.update(users, userId, {
      verification_token: token,
      verification_expires_at: Date.now() + 60_000,
    });

    let response = await router.fetch(
      new URL(routes.auth.verify.action.href(), base),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      },
    );

    assert.equal(response.status, 403);
    let user = await db.find(users, userId);
    assert.equal(user?.email_verified, false);
    assert.equal(user?.verification_token, token);
  });

  it('rejects a duplicate email without creating another user', async () => {
    let email = `auth-${crypto.randomUUID()}@example.com`;
    let organizationName = `Duplicate Test Studio ${crypto.randomUUID()}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let page = await router.fetch(new URL(routes.auth.register.index.href(), base));
      let csrf = extractCsrf(await page.text());
      let response = await router.fetch(new URL(routes.auth.register.action.href(), base), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieFromResponse(page),
        },
        body: new URLSearchParams({
          email,
          organization_name: organizationName,
          password: 'password123',
          _csrf: csrf,
        }).toString(),
      });
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get('Location'),
        attempt === 0
          ? routes.auth.login.index.href()
          : routes.auth.register.index.href(),
      );
    }

    let rows = await db.findMany(users, { where: { email } });
    assert.equal(rows.length, 1);
    let memberships = await db.findMany(organizationMemberships, {
      where: { user_id: rows[0].id },
    });
    assert.equal(memberships.length, 1);
    assert.equal(
      (await db.findMany(organizations, { where: { name: organizationName } })).length,
      1,
    );
  });
});
