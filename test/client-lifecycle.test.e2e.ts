import * as assert from 'remix/assert';
import { createTestServer } from 'remix/node-fetch-server/test';
import { describe, it } from 'remix/test';

import { clients } from '../app/data/db.ts';
import { routes } from '../app/routes.ts';
import { createTestRouter, seededDemoUser } from './router.ts';

/**
 * The archive/restore lifecycle flow in a real browser, on a page whose Archive control is
 * the shared RestfulForm submitting PUT through the method override. The app is served from
 * the shared test-router factory, the login is the real seeded round trip, and the Client
 * comes from the seed baseline, so the flow exercises exactly the state a fresh checkout
 * provisions.
 */
describe('client lifecycle', () => {
  it('archives and restores a seeded client from its profile page', async (t) => {
    let { router, db } = await createTestRouter();
    let page = await t.serve(await createTestServer(router.fetch));

    let pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    let consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(routes.auth.login.index.href());
    await page.getByLabel('Email', { exact: true }).fill(seededDemoUser.email);
    await page.getByLabel('Password', { exact: true }).fill(seededDemoUser.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL((url) => url.pathname === routes.app.dashboard.href());

    let clientId = 'seed-client-acme';
    await page.goto(routes.app.clients.show.href({ clientId }));
    await page.getByText('Active', { exact: true }).waitFor();
    assert.equal(
      (await db.findOne(clients, { where: { id: clientId } }))?.status,
      'active',
    );

    await page.getByRole('button', { name: 'Archive client' }).click();
    await page.getByRole('button', { name: 'Restore client' }).waitFor();
    await page.getByText('Archived', { exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Client archived' }).waitFor();
    assert.equal(
      (await db.findOne(clients, { where: { id: clientId } }))?.status,
      'archived',
    );

    await page.getByRole('button', { name: 'Restore client' }).click();
    await page.getByRole('button', { name: 'Archive client' }).waitFor();
    await page.getByText('Active', { exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Client restored' }).waitFor();
    assert.equal(
      (await db.findOne(clients, { where: { id: clientId } }))?.status,
      'active',
    );

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  });
});
