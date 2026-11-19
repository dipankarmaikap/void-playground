import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

/**
 * Creates the application's SQLite database connection for server startup and scripts. Tests
 * never call this: the shared test bootstrap constructs its own in-memory database explicitly
 * through the same adapter, so no environment branch lives in production code.
 *
 * `remix.json` mirrors these adapter settings for the `remix db` CLI — the same database
 * filename and `foreignKeys: true`. JSON can't hold comments, so this pointer lives here:
 * both must change together.
 */
export function createAppDatabase(): SqliteDatabase {
  let dbPath = join(import.meta.dirname, '..', '..', '..', 'data', 'app.db');
  mkdirSync(dirname(dbPath), { recursive: true });
  return createSqliteDatabase({ filename: dbPath, foreignKeys: true });
}
