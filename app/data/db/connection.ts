import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

/** True while `npm test` runs, which swaps the persistent developer database for an in-memory one. */
export const isTest = process.env.NODE_ENV === 'test';

const dbPath = isTest
  ? ':memory:'
  : join(import.meta.dirname, '..', '..', '..', 'data', 'app.db');

if (!isTest) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

/**
 * Creates the application's single SQLite database connection.
 *
 * `remix.json` mirrors these adapter settings for the `remix db` CLI — the same database
 * filename (`data/app.db` outside test mode) and `foreignKeys: true`. JSON can't hold
 * comments, so this pointer lives here: both must change together.
 */
export function createAppDatabase(): SqliteDatabase {
  return createSqliteDatabase({ filename: dbPath, foreignKeys: true });
}
