import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { column as c, table } from 'remix/data-table';
import type { TableRow } from 'remix/data-table';
import { createSqliteDatabase } from 'remix/data-table/sqlite';

const dbPath = join(import.meta.dirname, '..', '..', 'data', 'app.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const users = table({
  name: 'users',
  columns: {
    id: c.text().notNull(),
    email: c.text().notNull(),
    email_verified: c.boolean().notNull(),
    verification_token: c.text().nullable(),
    verification_expires_at: c.integer().nullable(),
    created_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    if ('email_verified' in value) {
      return { value: { ...value, email_verified: Boolean(value.email_verified) } };
    }
    return { value };
  },
});

export const userPasswords = table({
  name: 'user_passwords',
  columns: {
    user_id: c.text().notNull(),
    password_hash: c.text().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'user_id',
});

export const db = createSqliteDatabase({ filename: dbPath, foreignKeys: true });

await db.executeScript(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  verification_expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_passwords (
  user_id TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

export type User = TableRow<typeof users>;
export type UserPassword = TableRow<typeof userPasswords>;
