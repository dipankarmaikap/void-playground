import { fileURLToPath } from 'node:url';

import type { DatabaseMigrateOptions, MigrateResult } from 'remix/data-table/migrations';
import { loadMigrations } from 'remix/data-table/migrations/node';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { db } from '../db.ts';
import * as compatibility from './compatibility.ts';

/** Where the numbered SQL migrations live, resolved from this module like the app's other paths. */
const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));

/**
 * The single migration entry. Rejects incompatible legacy databases before any migration SQL
 * runs, applies every pending numbered migration through the Remix runner (journaling,
 * checksum drift detection, per-migration transaction wrapping), then verifies Organization
 * ownership. Server startup awaits this before the HTTP server starts listening, and the
 * shared test bootstrap applies it to the in-memory test database, so production and test
 * schemas come from the exact same code path.
 */
export async function migrateDatabase(
  database: SqliteDatabase = db,
  options?: DatabaseMigrateOptions,
): Promise<MigrateResult> {
  await compatibility.assertClientSchemaCompatible(database);
  let migrations = await loadMigrations(migrationsDirectory);
  let result = await database.migrate(migrations, options);
  await compatibility.assertOrganizationSchemaCompatible(database);
  return result;
}
