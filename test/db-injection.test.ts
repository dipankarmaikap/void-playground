import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { createSqliteDatabase } from 'remix/data-table/sqlite';

import { migrateDatabase } from '../app/data/db/migrate.ts';
import { createAppRouter } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { origin } from './http.ts';

/**
 * The injected-database seam: a caller-chosen database reaches the router, the session auth
 * scheme, and hybrid session storage, so request handling never depends on the module
 * singleton. The test builds its own database from the real migration history, so the router
 * under test is fully isolated from every other database in the process.
 */
describe('injected database', () => {
  it('constructs a router around a caller-chosen database', async () => {
    let injectedDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(injectedDb);
    let app = createAppRouter({ db: injectedDb });

    let loginPage = await app.fetch(new URL(routes.auth.login.index.href(), origin));

    assert.equal(loginPage.status, 200, 'the injected router should serve requests');

    await injectedDb.close();
  });
});
