import { db } from '../app/data/db.ts';
import { migrateDatabase } from '../app/data/db/migrate.ts';

/**
 * The shared test bootstrap: applies the real migration history to this process's in-memory test
 * database. Every test file that touches the database imports this module, so the schema exists
 * before any test runs. `remix test` forks one process per test file, so each file gets its own
 * empty database to migrate through the exact production code path.
 */
await migrateDatabase(db);
