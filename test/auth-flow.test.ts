import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import {
  db,
  organizationMemberships,
  organizations,
  users,
} from '../app/data/db.ts';
import { findOrganizationForUser } from '../app/data/organization/access.ts';

import {
  cookieFromResponse,
  createUser,
  extractCsrf,
  login,
  origin,
  postForm,
} from './http.ts';

async function register(body: Record<string, string>) {
  let response = await postForm(router, routes.auth.register.action.href(), body);
  return { response, html: await response.text() };
}

describe('auth flow', () => {
  it('registers an Organization and makes the registering User its owner', async () => {
    let email = `owner-${crypto.randomUUID()}@example.com`;
    let organizationName = `Studio ${crypto.randomUUID()}`;
    let forgedOrganizationId = crypto.randomUUID();
    let { response } = await register({
      email,
      password: 'password123',
      organization_name: `  ${organizationName}  `,
      organization_id: forgedOrganizationId,
    });

    assert.equal(response.status, 302);
    let user = await db.findOne(users, { where: { email } });
    assert.ok(user);

    let memberships = await db.findMany(organizationMemberships, {
      where: { user_id: user.id },
    });
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].is_owner, true);

    let organization = await db.find(organizations, memberships[0].organization_id);
    assert.equal(organization?.name, organizationName);
    assert.notEqual(memberships[0].organization_id, forgedOrganizationId);
    assert.equal(await db.find(organizations, forgedOrganizationId), null);
    assert.equal(
      (await db.findMany(organizations, { where: { name: organizationName } })).length,
      1,
    );
  });

  it('registers, verifies, and logs in', async () => {
    let email = `Flow-${crypto.randomUUID()}@Example.com`;
    let normalizedEmail = email.trim().toLowerCase();
    let password = 'password123';

    let registerResponse = await postForm(router, routes.auth.register.action.href(), {
      email,
      organization_name: 'Lovelace Analytics',
      password,
    });
    assert.equal(registerResponse.status, 302);
    assert.equal(registerResponse.headers.get('Location'), routes.auth.login.index.href());

    let user = await db.findOne(users, { where: { email: normalizedEmail } });
    assert.ok(user, 'registration should normalize the email');
    assert.ok(user.verification_token);
    assert.equal(user.email_verified, false);
    assert.equal((await findOrganizationForUser(user))?.name, 'Lovelace Analytics');

    let afterRegister = await router.fetch(new URL(routes.auth.login.index.href(), origin), {
      headers: { Cookie: cookieFromResponse(registerResponse) },
    });
    assert.match(
      await afterRegister.text(),
      /<p role="status"[^>]*>Check your email to verify your account<\/p>/,
    );

    let verifyUrl = new URL(routes.auth.verify.index.href(), origin);
    verifyUrl.searchParams.set('token', user.verification_token);
    let verifyPage = await router.fetch(verifyUrl);
    assert.equal(verifyPage.status, 200);
    assert.equal((await db.find(users, user.id))?.email_verified, false);

    let verifyHtml = await verifyPage.text();
    let csrf = verifyHtml.match(/name="_csrf"[^>]*value="([^"]+)"/)?.[1] ?? '';
    let verifyResponse = await router.fetch(
      new URL(routes.auth.verify.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieFromResponse(verifyPage),
        },
        body: new URLSearchParams({ token: user.verification_token, _csrf: csrf }).toString(),
      },
    );
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
    let forgedOrganizationId = crypto.randomUUID();
    let dashboardUrl = new URL(routes.app.dashboard.href(), origin);
    dashboardUrl.searchParams.set('organization_id', forgedOrganizationId);
    let dashboard = await router.fetch(dashboardUrl, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(dashboard.status, 200);
    let dashboardHtml = await dashboard.text();
    assert.match(dashboardHtml, /Welcome back/);
    assert.ok(dashboardHtml.includes('Lovelace Analytics'));
    assert.equal(dashboardHtml.includes(forgedOrganizationId), false);
  });

  it('registers with a trimmed display name', async () => {
    let email = `named-${crypto.randomUUID()}@example.com`;
    let { response } = await register({
      email,
      organization_name: 'Ada Industries',
      password: 'password123',
      display_name: '  Ada Lovelace  ',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let user = await db.findOne(users, { where: { email } });
    assert.ok(user);
    assert.equal(user?.display_name, 'Ada Lovelace');
    assert.ok(user?.verification_token);
    assert.equal(user?.email_verified, false);
    assert.equal((await findOrganizationForUser(user))?.name, 'Ada Industries');
  });

  it('registers without a display name', async () => {
    let email = `unnamed-${crypto.randomUUID()}@example.com`;
    let { response } = await register({
      email,
      organization_name: 'Unnamed Studio',
      password: 'password123',
    });

    assert.equal(response.status, 302);

    let user = await db.findOne(users, { where: { email } });
    assert.equal(user?.display_name, null);
  });

  it('treats a whitespace-only display name as unset', async () => {
    let email = `blank-${crypto.randomUUID()}@example.com`;
    let { response } = await register({
      email,
      organization_name: 'Blank Display Studio',
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
      organization_name: 'Long Name Studio',
      password: 'password123',
      display_name: displayName,
    });

    assert.equal(response.status, 400);
    assert.match(html, /80 characters/);
    assert.match(html, new RegExp(email));
    assert.match(html, /name="display_name"[^>]*value="x{81}"/);
    assert.equal(await db.findOne(users, { where: { email } }), null);

    // The normal email/password/verification flow still works after the error.
    let retry = await register({
      email,
      organization_name: 'Long Name Studio',
      password: 'password123',
    });
    assert.equal(retry.response.status, 302);
    let user = await db.findOne(users, { where: { email } });
    assert.ok(user?.verification_token);
  });

  it('renders the register form with a validation error', async () => {
    let { response, html } = await register({
      email: 'not-an-email',
      organization_name: 'Valid Studio',
      password: 'password123',
    });

    assert.equal(response.status, 400);
    assert.match(html, /Expected valid email/);
  });

  it('keeps an invalid registration retry CSRF-protected', async () => {
    let page = await router.fetch(new URL(routes.auth.register.index.href(), origin));
    let cookie = cookieFromResponse(page);
    let csrfToken = extractCsrf(await page.text());
    assert.ok(cookie);
    assert.ok(csrfToken);

    let actionUrl = new URL(routes.auth.register.action.href(), origin);
    let invalidResponse = await router.fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie,
      },
      body: new URLSearchParams({
        email: 'not-an-email',
        organization_name: 'Retry Studio',
        password: 'password123',
        _csrf: csrfToken,
      }).toString(),
    });
    assert.equal(invalidResponse.status, 400);
    let invalidHtml = await invalidResponse.text();
    assert.match(invalidHtml, /<p role="alert"[^>]*>Expected valid email<\/p>/);
    let retryCsrfToken = extractCsrf(invalidHtml);
    assert.ok(retryCsrfToken);

    let retry = await router.fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie,
      },
      body: new URLSearchParams({
        email: `retry-${crypto.randomUUID()}@example.com`,
        organization_name: 'Retry Studio',
        password: 'password123',
        _csrf: retryCsrfToken,
      }).toString(),
    });
    assert.equal(retry.status, 302);
    assert.equal(retry.headers.get('Location'), routes.auth.login.index.href());
  });

  it('rejects a whitespace-only Organization name with accessible feedback', async () => {
    let email = `blank-organization-${crypto.randomUUID()}@example.com`;
    let { response, html } = await register({
      email,
      organization_name: '   ',
      password: 'password123',
    });

    assert.equal(response.status, 400);
    assert.match(html, /<p role="alert"[^>]*>Organization name is required<\/p>/);
    assert.match(html, /name="organization_name"[^>]*value="   "/);
    assert.equal(await db.findOne(users, { where: { email } }), null);
  });

  it('requires an Organization name when the submitted field is missing', async () => {
    let email = `missing-organization-${crypto.randomUUID()}@example.com`;
    let response = await postForm(router, routes.auth.register.action.href(), {
      email,
      password: 'password123',
    });
    let html = await response.text();

    assert.equal(response.status, 400);
    assert.match(html, /<p role="alert"[^>]*>Organization name is required<\/p>/);
    assert.equal(await db.findOne(users, { where: { email } }), null);
  });

  it('fails closed instead of trusting a browser-supplied Organization ID', async () => {
    let email = `unassociated-${crypto.randomUUID()}@example.com`;
    let foreignEmail = `foreign-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let foreignUserId = await createUser(foreignEmail, 'password123');
    let foreignMembership = await db.findOne(organizationMemberships, {
      where: { user_id: foreignUserId },
    });
    assert.ok(foreignMembership);
    await db.deleteMany(organizationMemberships, { where: { user_id: userId } });

    let sessionCookie = await login(router, email, 'password123');
    let dashboardUrl = new URL(routes.app.dashboard.href(), origin);
    dashboardUrl.searchParams.set('organization_id', foreignMembership.organization_id);
    let response = await router.fetch(dashboardUrl, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(response.status, 403);
    assert.ok(await db.find(users, userId));

    let sessionsResponse = await router.fetch(
      new URL(routes.app.settings.sessions.index.href(), origin),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(sessionsResponse.status, 200);
    let sessionsHtml = await sessionsResponse.text();
    assert.match(sessionsHtml, /This session/);
    assert.ok(sessionsHtml.includes(email));
  });

  it('fails closed when an Organization selector would be needed', async () => {
    let email = `multiple-organizations-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let organizationId = crypto.randomUUID();
    let now = Date.now();
    await db.create(organizations, {
      id: organizationId,
      name: 'Second Organization',
      created_at: now,
      updated_at: now,
    });
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      is_owner: false,
      created_at: now,
    });

    let user = await db.find(users, userId);
    assert.ok(user);
    assert.equal(await findOrganizationForUser(user), null);

    let sessionCookie = await login(router, email, 'password123');
    let response = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 403);
  });

  it('rolls back User and Organization provisioning when owner membership fails', async () => {
    let email = `rollback-${crypto.randomUUID()}@example.com`;
    let organizationName = `Rollback Studio ${crypto.randomUUID()}`;
    let trigger = `reject_membership_${crypto.randomUUID().replaceAll('-', '')}`;
    let membershipCount = (await db.findMany(organizationMemberships)).length;
    await db.executeScript(`
      CREATE TRIGGER ${trigger}
      BEFORE INSERT ON organization_memberships
      BEGIN
        SELECT RAISE(ABORT, 'owner membership failed');
      END;
    `);

    let requestFailed = false;
    try {
      let { response } = await register({
        email,
        organization_name: organizationName,
        password: 'password123',
      });
      requestFailed = response.status >= 500;
    } catch {
      requestFailed = true;
    } finally {
      await db.executeScript(`DROP TRIGGER ${trigger}`);
    }

    assert.equal(requestFailed, true);
    assert.equal(await db.findOne(users, { where: { email } }), null);
    assert.equal(
      (await db.findMany(organizations, { where: { name: organizationName } })).length,
      0,
    );
    assert.equal(
      (await db.findMany(organizationMemberships)).length,
      membershipCount,
    );
  });
});
