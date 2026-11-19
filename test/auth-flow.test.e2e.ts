import * as assert from 'remix/assert';
import { createTestServer } from 'remix/node-fetch-server/test';
import { describe, it } from 'remix/test';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import type { Page } from 'playwright';

import { users } from '../app/data/db.ts';
import { routes } from '../app/routes.ts';
import { createTestRouter } from './router.ts';

/**
 * The register → verify → login → dashboard flow in a real browser, once with JavaScript
 * enabled and once without. The app is served from the shared test-router factory (its own
 * seeded in-memory database), so the flow starts from the same baseline every run and the
 * final login exercises the real CSRF-protected round trips, never faked auth state.
 */
describe('registration and login', () => {
  it('signs up, verifies, and opens the dashboard with JavaScript enabled', async (t) => {
    let { router, db } = await createTestRouter();
    let page = await t.serve(await createTestServer(router.fetch));
    await registrationFlow(page, db, true);
  });

  it('signs up, verifies, and opens the dashboard without JavaScript', async (t) => {
    let { router, db } = await createTestRouter();
    let server = await createTestServer(router.fetch);
    let runtimePage = await t.serve(server);
    let browser = runtimePage.context().browser();
    assert.ok(browser);
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false });
    // Release this context's connections before t.serve() cleanup closes the server.
    try {
      await registrationFlow(await context.newPage(), db, false);
    } finally {
      await context.close();
    }
  });
});

async function registrationFlow(
  page: Page,
  db: SqliteDatabase,
  javaScriptEnabled: boolean,
): Promise<void> {
  let pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let email = `e2e-${crypto.randomUUID()}@example.test`;
  await page.goto(routes.auth.register.index.href());

  if (javaScriptEnabled) {
    // The document must ship the module entry, and the rest of the flow then proves it ran
    // cleanly: any load or hydration failure surfaces as a page error or a console error
    // (the entry reports runtime errors through console.error), so the assertions at the
    // end are the hydration-health proof. The upstream demo waits by importing the entry
    // module from the page, but this app's stricter nonce-only CSP (no 'self' in
    // script-src) blocks that dynamic import, so the flow observes it from outside instead.
    assert.equal(
      (await page.locator('script[type="module"][src]').count()) > 0,
      true,
      'The document must ship a module entry script',
    );
  }

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Organization name').fill('E2e Studio');
  await page.getByLabel(/Display name/).fill('E2e Owner');
  await page.getByLabel('Password', { exact: true }).fill('e2e-valid-password');
  await page.getByRole('button', { name: 'Create Organization' }).click();

  await page.waitForURL((url) => url.pathname === routes.auth.login.index.href());
  await page
    .getByRole('status')
    .filter({ hasText: 'Check your email to verify your account' })
    .waitFor();

  // The verification link is only printed to the server console, so read the token the
  // registration just persisted, the way the emailed link would carry it.
  let user = await db.findOne(users, { where: { email } });
  assert.ok(user, 'Registration must persist the User');
  assert.equal(user.email_verified, false);
  let token = user.verification_token;
  assert.ok(token);

  await page.goto(`${routes.auth.verify.index.href()}?token=${token}`);
  await page.getByRole('button', { name: 'Verify email address' }).click();

  await page.waitForURL((url) => url.pathname === routes.auth.login.index.href());
  await page.getByRole('status').filter({ hasText: 'Email verified. You can now log in.' }).waitFor();

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('e2e-valid-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await page.waitForURL((url) => url.pathname === routes.app.dashboard.href());
  await page.getByRole('heading', { name: 'Welcome back, E2e Owner' }).waitFor();
  await page.getByText(`You are signed in as ${email}`).waitFor();

  if (javaScriptEnabled) {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.equal(
      await page.getByRole('alert').filter({ hasText: 'Something went wrong' }).count(),
      0,
      'The runtime-error recovery notice must never appear',
    );
  }
}
