import { createContextKey, type Middleware } from 'remix/router';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

/** The request-context key holding the database for the current request. */
export const databaseContext = createContextKey<SqliteDatabase>();

/**
 * Installs the caller-chosen database into the request context as `context.db`. Runs at the
 * router level so every controller — including controllers of nested route maps, which do not
 * inherit controller-level middleware — receives the same database instance.
 */
export function loadDatabase(
  db: SqliteDatabase,
): Middleware<{
  key: typeof databaseContext;
  value: SqliteDatabase;
  property: 'db';
}> {
  return (context, next) => {
    context.set(databaseContext, db, { property: 'db' });
    return next();
  };
}
