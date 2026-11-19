import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import {
  organizationGstRatePresets,
  organizationMemberships,
  organizations,
  sessions,
  userPasswords,
  users,
} from '../app/data/db.ts';
import { migrateDatabase } from '../app/data/db/migrate.ts';
import { defaultGstPresetRows } from '../app/data/organization/gst-presets.ts';
import { hashPassword } from '../app/data/password.ts';
import { createAppRouter } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { cookieFromResponse, extractCsrf, origin } from './http.ts';

/** A verified User with an owned Organization, created directly in the given database. */
async function createUserIn(db: SqliteDatabase, email: string): Promise<string> {
  let userId = crypto.randomUUID();
  let organizationId = crypto.randomUUID();
  let now = Date.now();
  let passwordHash = await hashPassword('password123');
  await db.create(users, { id: userId, email, email_verified: true, created_at: now });
  await db.create(userPasswords, {
    user_id: userId,
    password_hash: passwordHash,
    updated_at: now,
  });
  await db.create(organizations, {
    id: organizationId,
    name: 'Injected Studio',
    created_at: now,
    updated_at: now,
  });
  await db.create(organizationMemberships, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    user_id: userId,
    is_owner: true,
    created_at: now,
  });
  for (let preset of defaultGstPresetRows(organizationId, now)) {
    await db.create(organizationGstRatePresets, preset);
  }
  return userId;
}

/**
 * The injected-database seam: a caller-chosen database reaches the router, controllers, the
 * session auth scheme, and hybrid session storage, so request handling never depends on the
 * module singleton. The test builds its own database from the real migration history, so the
 * router under test is fully isolated from every other database in the process.
 */
describe('injected database', () => {
  it('runs the login and dashboard flow against a caller-chosen database', async () => {
    let injectedDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(injectedDb);
    let app = createAppRouter({ db: injectedDb });

    let email = `injected-${crypto.randomUUID()}@example.com`;
    let userId = await createUserIn(injectedDb, email);

    let loginPage = await app.fetch(new URL(routes.auth.login.index.href(), origin));
    let login = await app.fetch(new URL(routes.auth.login.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieFromResponse(loginPage),
      },
      body: new URLSearchParams({
        email,
        password: 'password123',
        _csrf: extractCsrf(await loginPage.text()),
      }).toString(),
    });

    assert.equal(login.status, 302, 'login against the injected database should redirect');
    assert.equal(login.headers.get('Location'), routes.app.dashboard.href());

    let storedSessions = await injectedDb.findMany(sessions, { where: { user_id: userId } });
    assert.equal(
      storedSessions.length,
      1,
      'hybrid session storage must persist the Session in the injected database',
    );

    let dashboard = await app.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: cookieFromResponse(login) },
    });
    assert.equal(dashboard.status, 200);
    let dashboardHtml = await dashboard.text();
    assert.ok(
      dashboardHtml.includes('Injected Studio'),
      'Organization resolution must read the injected database',
    );

    await injectedDb.close();
  });
});
