import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { routes } from '../app/routes.ts';
import { organizationMemberships, organizations, sessions, users } from '../app/data/db.ts';
import { cookieFromResponse, extractCsrf, origin, postForm } from './http.ts';
import { createTestRouter, loginAsDemoUser, seededDemoUser } from './router.ts';

describe('test router factory', () => {
  it('resets the database from the migrations and the seed baseline', async () => {
    let { db } = await createTestRouter();

    let user = await db.findOne(users, { where: { email: seededDemoUser.email } });
    assert.ok(user, 'the seeded demo User exists');
    assert.equal(user.email_verified, true, 'the demo User can sign in immediately');

    let membership = await db.findOne(organizationMemberships, { where: { user_id: user.id } });
    assert.ok(membership, 'the demo User owns the seeded Organization');
    let organization = await db.find(organizations, membership.organization_id);
    assert.equal(organization?.name, 'Meridian Design Studio');
  });

  it('logs the seeded demo User in through a real CSRF-scraping round trip', async () => {
    let { router, db } = await createTestRouter();

    let sessionCookie = await loginAsDemoUser(router);

    let user = await db.findOne(users, { where: { email: seededDemoUser.email } });
    assert.ok(user);
    let sessionRows = await db.findMany(sessions, { where: { user_id: user.id } });
    assert.equal(
      sessionRows.length,
      1,
      'login mints the authenticated Session in the database (ADR-0001)',
    );

    let dashboard = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(dashboard.status, 200);
    let html = await dashboard.text();
    assert.match(html, /Welcome back/);
    assert.ok(html.includes('Meridian Design Studio'), 'the seeded Organization is resolved');
  });

  it('builds every router from an isolated database, so no test leaks state to another', async () => {
    let first = await createTestRouter();
    let second = await createTestRouter();

    let email = `isolated-${crypto.randomUUID()}@example.com`;
    let registerResponse = await postForm(first.router, routes.auth.register.action.href(), {
      email,
      organization_name: 'Isolation Studio',
      password: 'password123',
    });
    assert.equal(registerResponse.status, 302);

    assert.ok(
      await first.db.findOne(users, { where: { email } }),
      'the first router sees the registration',
    );
    assert.equal(
      await second.db.findOne(users, { where: { email } }),
      null,
      'the second router never sees another router’s state',
    );
    assert.equal((await second.db.findMany(users)).length, 1, 'only the seeded demo User exists');
  });

  it('retires the pre-login cookie once login rotates the Session id', async () => {
    let { router } = await createTestRouter();

    let loginPage = await router.fetch(new URL(routes.auth.login.index.href(), origin));
    let preLoginCookie = cookieFromResponse(loginPage);
    let csrf = extractCsrf(await loginPage.text());
    assert.ok(csrf, 'the login page carries a CSRF token');

    let signedIn = await router.fetch(new URL(routes.auth.login.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: preLoginCookie,
      },
      body: new URLSearchParams({
        email: seededDemoUser.email,
        password: seededDemoUser.password,
        _csrf: csrf,
      }).toString(),
    });
    assert.equal(signedIn.status, 302);

    let withPreLoginCookie = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: preLoginCookie },
    });
    assert.equal(
      withPreLoginCookie.status,
      302,
      'the pre-login cookie must not authenticate after login',
    );
    let loginLocation = new URL(withPreLoginCookie.headers.get('Location') ?? '', origin);
    assert.equal(loginLocation.pathname, routes.auth.login.index.href());
  });
});
