import { fileURLToPath } from 'node:url';

import type { DatabaseMigrateOptions, MigrateResult } from 'remix/data-table/migrations';
import { loadMigrations } from 'remix/data-table/migrations/node';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { db } from '../db.ts';

/** Where the numbered SQL migrations live, resolved from this module like the app's other paths. */
export const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));

/**
 * The single migration entry: loads the numbered SQL migrations and applies every pending one
 * through the Remix runner (journaling, checksum drift detection, per-migration transaction
 * wrapping). Server startup awaits this before the HTTP server starts listening, and the shared
 * test bootstrap applies it to the in-memory test database, so production and test schemas come
 * from the exact same code path. Databases are disposable build-phase artifacts (ADR-0003): the
 * documented remedy for a stale or unrecognized dev database is deleting the file and restarting,
 * so this entry guards nothing and upgrades nothing.
 */
export async function migrateDatabase(
  database: SqliteDatabase = db,
  options?: DatabaseMigrateOptions,
): Promise<MigrateResult> {
  let migrations = await loadMigrations(migrationsDirectory);
  return database.migrate(migrations, options);
}
