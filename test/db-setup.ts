import type { AnyTable } from 'remix/data-table';

import { db } from '../app/data/db.ts';
import { migrateDatabase } from '../app/data/db/migrate.ts';

/**
 * The shared test bootstrap: applies the real migration history to this process's in-memory test
 * database. Every test file that touches the database imports this module, so the schema exists
 * before any test runs. `remix test` forks one process per test file, so each file gets its own
 * empty database to migrate through the exact production code path.
 */
await migrateDatabase(db);

/**
 * The shared between-test cleanup: removes every row from exactly the named tables, so each call
 * site stays scoped to what its own tests dirty and no hand-written SQL cleanup accumulates. The
 * query builder's where-less `delete()` is the typed API's explicit full-table delete; the CRUD
 * helpers reject it so accidental wipes cannot slip through a `where` typo. When several tables
 * are named, child tables must come before the parents they reference: foreign keys stay
 * enforced.
 */
export async function clearTestTables(...tables: AnyTable[]): Promise<void> {
  for (let table of tables) {
    await db.query(table).delete();
  }
}
