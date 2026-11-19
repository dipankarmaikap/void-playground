import { fileURLToPath } from 'node:url';

import { createCookie } from 'remix/cookie';
import { loadMigrations, loadSeed } from 'remix/data-table/migrations/node';
import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { createMemorySessionStorage } from 'remix/session-storage/memory';

import { createAppRouter } from '../app/router.ts';
import { migrationsDirectory } from '../app/data/db/migrate.ts';
import {
  createHybridSessionStorage,
  SESSION_TTL_SECONDS,
} from '../app/data/session/storage.ts';
import { login, type TestApp } from './http.ts';

/**
 * The idempotent baseline seed, resolved from the app's data module like the migrations
 * directory. The factory resets from the exact SQL `remix db seed` runs, so a test's
 * starting state is the state a fresh checkout provisions for development.
 */
const seedPath = fileURLToPath(new URL('../app/data/db/seed.sql', import.meta.url));

/** The seeded demo account, documented in seed.sql alongside its pre-hashed password. */
export const seededDemoUser = {
  email: 'demo@meridian.test',
  password: 'demo-password',
} as const;

/** A router plus the isolated database it was built around, for direct row assertions. */
export interface TestRouter {
  router: ReturnType<typeof createAppRouter>;
  db: SqliteDatabase;
}

/**
 * Builds the app around its own in-memory database, reset from the SQL migrations and the
 * seed baseline through the framework's `db.reset()`, so every test file starts from an
 * identical, isolated state (`remix test` forks one process per file, and each file builds
 * its own router here). The session cookie is a test-only cookie with a fixed secret, and
 * the hybrid session storage (ADR-0001) keeps its database-backed post-login half — only the
 * pre-login cookie half is swapped for in-memory storage, so anonymous CSRF round trips never
 * touch the database. Test logins are real round trips (see `loginAsDemoUser`), never faked
 * auth state.
 */
export async function createTestRouter(): Promise<TestRouter> {
  let db = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
  await db.reset({
    migrations: await loadMigrations(migrationsDirectory),
    seed: await loadSeed(seedPath),
  });

  let sessionCookie = createCookie('__session', {
    secrets: ['test-secret-for-the-router-factory'],
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  let sessionStorage = createHybridSessionStorage(db, createMemorySessionStorage());
  let router = createAppRouter({ db, sessionCookie, sessionStorage });
  return { router, db };
}

/**
 * Signs in as the seeded demo User through the real login flow: fetch the login page, scrape
 * the CSRF token, POST the credentials, and return the session cookie the server mints.
 */
export function loginAsDemoUser(app: TestApp): Promise<string> {
  return login(app, seededDemoUser.email, seededDemoUser.password);
}
