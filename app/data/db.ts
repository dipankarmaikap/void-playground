import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { column as c, getTableReference, table } from 'remix/data-table';
import type { TableRow } from 'remix/data-table';
import { createSqliteDatabase } from 'remix/data-table/sqlite';

const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : join(import.meta.dirname, '..', '..', 'data', 'app.db');

if (!isTest) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export const users = table({
  name: 'users',
  columns: {
    id: c.text().notNull(),
    email: c.text().notNull(),
    display_name: c.text().nullable(),
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

export const organizations = table({
  name: 'organizations',
  columns: {
    id: c.text().notNull(),
    name: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

export const organizationMemberships = table({
  name: 'organization_memberships',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    user_id: c.text().notNull(),
    is_owner: c.boolean().notNull(),
    created_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    if ('is_owner' in value) {
      return { value: { ...value, is_owner: Boolean(value.is_owner) } };
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

export const sessions = table({
  name: 'sessions',
  columns: {
    id: c.text().notNull(),
    user_id: c.text().notNull(),
    data: c.text().notNull(),
    ip: c.text().nullable(),
    user_agent: c.text().nullable(),
    created_at: c.integer().notNull(),
    last_active_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

export const clients = table({
  name: 'clients',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    type: c.enum(['individual', 'business'] as const).notNull(),
    legal_name: c.text().notNull(),
    preferred_name: c.text().nullable(),
    trading_name: c.text().nullable(),
    industry: c.text().nullable(),
    email: c.text().nullable(),
    phone: c.text().nullable(),
    contact_name: c.text().nullable(),
    contact_role: c.text().nullable(),
    contact_email: c.text().nullable(),
    contact_phone: c.text().nullable(),
    billing_line1: c.text().nullable(),
    billing_locality: c.text().nullable(),
    billing_region: c.text().nullable(),
    billing_postal_code: c.text().nullable(),
    billing_country: c.text().nullable(),
    billing_currency: c.text().nullable(),
    tax_country: c.text().nullable(),
    tax_type: c.text().nullable(),
    tax_value: c.text().nullable(),
    tax_state_name: c.text().nullable(),
    tax_state_code: c.text().nullable(),
    status: c.enum(['active', 'archived'] as const).notNull(),
    archived_at: c.integer().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

export const db = createSqliteDatabase({ filename: dbPath, foreignKeys: true });

function missingClientOrganizationSchemaError(): Error {
  return new Error(
    'This database schema is missing required Client Organization ownership. ' +
      'Stop the app and perform the operator-managed clean start before continuing. ' +
      'No stored data was deleted.',
  );
}

/** Rejects a persisted pre-Organization Client schema before startup creates any new tables. */
export async function assertClientSchemaCompatible(database: typeof db = db): Promise<void> {
  let clientTable = getTableReference(clients);
  if (
    (await database.hasTable(clientTable)) &&
    !(await database.hasColumn(clientTable, 'organization_id'))
  ) {
    throw missingClientOrganizationSchemaError();
  }
}

if (!isTest) {
  await assertClientSchemaCompatible();
}

await db.executeScript(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  verification_expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
    CHECK (
      length(trim(name, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
    ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_owner INTEGER NOT NULL CHECK (is_owner IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_passwords (
  user_id TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id
  ON organization_memberships(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_memberships_one_owner
  ON organization_memberships(organization_id) WHERE is_owner = 1;
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual', 'business')),
  legal_name TEXT NOT NULL,
  preferred_name TEXT,
  trading_name TEXT,
  industry TEXT,
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_line1 TEXT,
  billing_locality TEXT,
  billing_region TEXT,
  billing_postal_code TEXT,
  billing_country TEXT,
  billing_currency TEXT,
  tax_country TEXT,
  tax_type TEXT,
  tax_value TEXT,
  tax_state_name TEXT,
  tax_state_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_legal_name ON clients(legal_name);
CREATE INDEX IF NOT EXISTS idx_clients_tax_value ON clients(tax_value);
`);

if (!(await db.hasColumn(getTableReference(users), 'display_name'))) {
  await db.executeScript('ALTER TABLE users ADD COLUMN display_name TEXT;');
}

// Later Client tickets are expected to add nullable columns. Keep each ALTER guarded so an
// existing database never fails on a column it already has, and add one statement at a time.
const clientExtraColumns: Array<[string, string]> = [];

for (let [columnName, sqlType] of clientExtraColumns) {
  if (!(await db.hasColumn(getTableReference(clients), columnName))) {
    await db.executeScript(`ALTER TABLE clients ADD COLUMN ${columnName} ${sqlType};`);
  }
}

export async function assertOrganizationSchemaCompatible(
  database: typeof db = db,
): Promise<void> {
  let clientsHaveOrganization = await database.hasColumn(
    getTableReference(clients),
    'organization_id',
  );
  if (!clientsHaveOrganization) {
    throw missingClientOrganizationSchemaError();
  }

  let [existingUsers, memberships] = await Promise.all([
    database.findMany(users),
    database.findMany(organizationMemberships),
  ]);
  let membershipCounts = new Map<string, number>();
  for (let membership of memberships) {
    membershipCounts.set(
      membership.user_id,
      (membershipCounts.get(membership.user_id) ?? 0) + 1,
    );
  }
  let hasUnassociatedUsers = existingUsers.some(
    (user) => (membershipCounts.get(user.id) ?? 0) === 0,
  );
  if (hasUnassociatedUsers) {
    throw new Error(
      'This database contains identity or Client data without Organization ownership. ' +
        'Stop the app and perform the operator-managed clean start before continuing. ' +
        'No stored data was deleted.',
    );
  }
}

if (!isTest) {
  await assertOrganizationSchemaCompatible();
}

await db.executeScript(`
CREATE INDEX IF NOT EXISTS idx_clients_organization_status
  ON clients(organization_id, status);
`);

export type User = TableRow<typeof users>;
export type Organization = TableRow<typeof organizations>;
export type OrganizationMembership = TableRow<typeof organizationMemberships>;
export type UserPassword = TableRow<typeof userPasswords>;
export type SessionRow = TableRow<typeof sessions>;
export type Client = TableRow<typeof clients>;
