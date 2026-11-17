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

/**
 * Organization-owned seller profile used by invoices. One row per Organization; the effective
 * legal seller name falls back to `organizations.name` when `legal_name` is null.
 */
export const organizationInvoicingProfiles = table({
  name: 'organization_invoicing_profiles',
  columns: {
    organization_id: c.text().notNull(),
    legal_name: c.text().nullable(),
    address_line1: c.text().nullable(),
    address_locality: c.text().nullable(),
    address_region: c.text().nullable(),
    address_postal_code: c.text().nullable(),
    address_country: c.text().nullable(),
    billing_email: c.text().nullable(),
    billing_phone: c.text().nullable(),
    pan: c.text().nullable(),
    gst_registered: c.boolean().notNull(),
    gstin: c.text().nullable(),
    gst_state_code: c.text().nullable(),
    gst_state_name: c.text().nullable(),
    default_currency: c.text().notNull(),
    payment_term: c.text().notNull(),
    custom_payment_terms: c.text().nullable(),
    payment_instructions: c.text().nullable(),
    customer_notes: c.text().nullable(),
    invoice_prefix: c.text().notNull(),
    invoice_starting_number: c.integer().notNull(),
    credit_note_prefix: c.text().notNull(),
    credit_note_starting_number: c.integer().notNull(),
    logo_data_url: c.text().nullable(),
    signature_data_url: c.text().nullable(),
    signatory_name: c.text().nullable(),
    signatory_designation: c.text().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'organization_id',
  afterRead({ value }) {
    if ('gst_registered' in value) {
      return { value: { ...value, gst_registered: Boolean(value.gst_registered) } };
    }
    return { value };
  },
});

/**
 * Organization-owned, editable Indian GST rate presets. Rates are stored as canonical decimal
 * strings so invoice calculations never inherit floating-point rounding from the database.
 */
export const organizationGstRatePresets = table({
  name: 'organization_gst_rate_presets',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    rate: c.text().notNull(),
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

/**
 * An Organization-scoped invoice. Drafts carry no `invoice_number`; that is allocated only when
 * the invoice is issued in a later ticket. Recipient details are copied from the Client at draft
 * creation so later edits to the Draft never change the Client profile.
 */
export const invoices = table({
  name: 'invoices',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    client_id: c.text().notNull(),
    document_type: c.text().notNull(),
    status: c.text().notNull(),
    invoice_number: c.text().nullable(),
    currency: c.text().notNull(),
    invoice_date: c.text().notNull(),
    due_date: c.text().notNull(),
    payment_term: c.text().notNull(),
    custom_payment_terms: c.text().nullable(),
    recipient_legal_name: c.text().notNull(),
    recipient_billing_line1: c.text().nullable(),
    recipient_billing_locality: c.text().nullable(),
    recipient_billing_region: c.text().nullable(),
    recipient_billing_postal_code: c.text().nullable(),
    recipient_billing_country: c.text().nullable(),
    recipient_tax_country: c.text().nullable(),
    recipient_tax_type: c.text().nullable(),
    recipient_tax_value: c.text().nullable(),
    recipient_tax_state_name: c.text().nullable(),
    recipient_tax_state_code: c.text().nullable(),
    gst_mode: c.text().notNull(),
    supply_type: c.text().nullable(),
    place_of_supply_state_code: c.text().nullable(),
    place_of_supply_state_name: c.text().nullable(),
    place_of_supply_country: c.text().nullable(),
    recipient_gstin_applicable: c.boolean().notNull(),
    reverse_charge: c.boolean().notNull(),
    export_reference: c.text().nullable(),
    payment_instructions: c.text().nullable(),
    customer_notes: c.text().nullable(),
    internal_note: c.text().nullable(),
    subtotal_minor: c.integer().notNull(),
    line_discount_total_minor: c.integer().notNull(),
    invoice_discount_mode: c.text().nullable(),
    invoice_discount_value: c.text().nullable(),
    invoice_discount_minor: c.integer().notNull(),
    net_subtotal_minor: c.integer().notNull(),
    tax_total_minor: c.integer().notNull(),
    round_off_minor: c.integer().notNull(),
    total_minor: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    if ('recipient_gstin_applicable' in value) {
      return {
        value: {
          ...value,
          recipient_gstin_applicable: Boolean(value.recipient_gstin_applicable),
          reverse_charge: Boolean(value.reverse_charge),
        },
      };
    }
    return { value };
  },
});

/** A free-form service line belonging to one invoice in the same Organization. */
export const invoiceLines = table({
  name: 'invoice_lines',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    position: c.integer().notNull(),
    description: c.text().notNull(),
    sac: c.text().nullable(),
    quantity: c.text().notNull(),
    unit_price: c.text().notNull(),
    amount_minor: c.integer().notNull(),
    discount_mode: c.text().nullable(),
    discount_value: c.text().nullable(),
    line_discount_minor: c.integer().notNull(),
    allocated_invoice_discount_minor: c.integer().notNull(),
    net_minor: c.integer().notNull(),
    tax_treatment: c.text().nullable(),
    gst_rate: c.text().nullable(),
    cgst_rate: c.text().nullable(),
    sgst_rate: c.text().nullable(),
    igst_rate: c.text().nullable(),
    cgst_amount_minor: c.integer().notNull(),
    sgst_amount_minor: c.integer().notNull(),
    igst_amount_minor: c.integer().notNull(),
    foreign_tax_label: c.text().nullable(),
    foreign_tax_mode: c.text().nullable(),
    foreign_tax_rate: c.text().nullable(),
    foreign_tax_amount_minor: c.integer().notNull(),
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

CREATE TABLE IF NOT EXISTS organization_invoicing_profiles (
  organization_id TEXT PRIMARY KEY NOT NULL,
  legal_name TEXT CHECK (legal_name IS NULL OR length(trim(legal_name)) > 0),
  address_line1 TEXT,
  address_locality TEXT,
  address_region TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  billing_email TEXT CHECK (billing_email IS NULL OR length(trim(billing_email)) > 0),
  billing_phone TEXT CHECK (billing_phone IS NULL OR length(trim(billing_phone)) > 0),
  pan TEXT CHECK (pan IS NULL OR length(pan) = 10),
  gst_registered INTEGER NOT NULL DEFAULT 0 CHECK (gst_registered IN (0, 1)),
  gstin TEXT,
  gst_state_code TEXT,
  gst_state_name TEXT,
  default_currency TEXT NOT NULL DEFAULT 'INR'
    CHECK (default_currency GLOB '[A-Z][A-Z][A-Z]'),
  payment_term TEXT NOT NULL DEFAULT 'due_on_receipt'
    CHECK (payment_term IN (
      'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
    )),
  custom_payment_terms TEXT CHECK (
    custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200
  ),
  payment_instructions TEXT CHECK (
    payment_instructions IS NULL OR length(payment_instructions) <= 1000
  ),
  customer_notes TEXT CHECK (
    customer_notes IS NULL OR length(customer_notes) <= 1000
  ),
  invoice_prefix TEXT NOT NULL DEFAULT 'INV' CHECK (
    length(invoice_prefix) BETWEEN 1 AND 12
    AND invoice_prefix NOT GLOB '*[/]*'
    AND invoice_prefix NOT GLOB '*[^A-Z0-9_-]*'
  ),
  invoice_starting_number INTEGER NOT NULL DEFAULT 1 CHECK (invoice_starting_number >= 1),
  credit_note_prefix TEXT NOT NULL DEFAULT 'CN' CHECK (
    length(credit_note_prefix) BETWEEN 1 AND 12
    AND credit_note_prefix NOT GLOB '*[/]*'
    AND credit_note_prefix NOT GLOB '*[^A-Z0-9_-]*'
  ),
  credit_note_starting_number INTEGER NOT NULL DEFAULT 1 CHECK (credit_note_starting_number >= 1),
  logo_data_url TEXT CHECK (
    logo_data_url IS NULL OR (
      length(logo_data_url) <= 175000 AND (
        logo_data_url GLOB 'data:image/png;base64,*'
        OR logo_data_url GLOB 'data:image/jpeg;base64,*'
        OR logo_data_url GLOB 'data:image/webp;base64,*'
      )
    )
  ),
  signature_data_url TEXT CHECK (
    signature_data_url IS NULL OR (
      length(signature_data_url) <= 175000 AND (
        signature_data_url GLOB 'data:image/png;base64,*'
        OR signature_data_url GLOB 'data:image/jpeg;base64,*'
        OR signature_data_url GLOB 'data:image/webp;base64,*'
      )
    )
  ),
  signatory_name TEXT CHECK (signatory_name IS NULL OR length(signatory_name) <= 120),
  signatory_designation TEXT CHECK (
    signatory_designation IS NULL OR length(signatory_designation) <= 100
  ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (
      address_line1 IS NULL AND address_locality IS NULL AND address_region IS NULL
      AND address_postal_code IS NULL AND address_country IS NULL
    )
    OR (
      address_line1 IS NOT NULL AND length(trim(address_line1)) > 0
      AND address_country IS NOT NULL AND length(trim(address_country)) > 0
    )
  ),
  CHECK (gst_registered = 0 OR (
    gstin IS NOT NULL AND length(gstin) = 15
    AND gst_state_code IS NOT NULL AND length(gst_state_code) = 2
  )),
  CHECK (gst_registered = 1 OR (
    gstin IS NULL AND gst_state_code IS NULL AND gst_state_name IS NULL
  )),
  CHECK (invoice_prefix <> credit_note_prefix),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organization_gst_rate_presets (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  rate TEXT NOT NULL CHECK (
    length(rate) > 0
    AND rate GLOB '[0-9]*'
    AND rate NOT GLOB '*[^0-9.]*'
    AND rate NOT LIKE '%.%.%'
    AND CAST(rate AS REAL) >= 0
    AND CAST(rate AS REAL) <= 100
  ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (organization_id, rate)
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
CREATE INDEX IF NOT EXISTS idx_gst_presets_organization
  ON organization_gst_rate_presets(organization_id);

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

// #42 adds Organization-scoped invoices with same-Organization composite foreign keys. SQLite
// requires the parent key to be unique, so the matching indexes are created alongside the tables.
await db.executeScript(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id, id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'credit_note')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft')),
  invoice_number TEXT CHECK (
    invoice_number IS NULL OR (status <> 'draft' AND length(trim(invoice_number)) > 0)
  ),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  invoice_date TEXT NOT NULL CHECK (
    invoice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  due_date TEXT NOT NULL CHECK (
    due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  payment_term TEXT NOT NULL CHECK (payment_term IN (
    'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
  )),
  custom_payment_terms TEXT CHECK (custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200),
  recipient_legal_name TEXT NOT NULL CHECK (length(trim(recipient_legal_name)) > 0),
  recipient_billing_line1 TEXT,
  recipient_billing_locality TEXT,
  recipient_billing_region TEXT,
  recipient_billing_postal_code TEXT,
  recipient_billing_country TEXT,
  recipient_tax_country TEXT,
  recipient_tax_type TEXT,
  recipient_tax_value TEXT,
  recipient_tax_state_name TEXT,
  recipient_tax_state_code TEXT,
  gst_mode TEXT NOT NULL DEFAULT 'none' CHECK (
    gst_mode IN ('none', 'india_gst', 'foreign_manual')
  ),
  supply_type TEXT CHECK (supply_type IN ('domestic', 'export_lut', 'export_igst')),
  place_of_supply_state_code TEXT,
  place_of_supply_state_name TEXT,
  place_of_supply_country TEXT,
  recipient_gstin_applicable INTEGER NOT NULL DEFAULT 0 CHECK (recipient_gstin_applicable IN (0, 1)),
  reverse_charge INTEGER NOT NULL DEFAULT 0 CHECK (reverse_charge IN (0, 1)),
  export_reference TEXT CHECK (export_reference IS NULL OR length(export_reference) <= 200),
  payment_instructions TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000),
  customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000),
  internal_note TEXT CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
  subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  line_discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0),
  invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed')),
  invoice_discount_value TEXT CHECK (
    invoice_discount_value IS NULL OR (
      length(invoice_discount_value) > 0
      AND invoice_discount_value GLOB '[0-9]*'
      AND invoice_discount_value NOT GLOB '*[^0-9.]*'
      AND invoice_discount_value NOT LIKE '%.%.%'
    )
  ),
  invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0),
  net_subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0),
  tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
  round_off_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (invoice_discount_mode IS NOT NULL OR (
    invoice_discount_value IS NULL AND invoice_discount_minor = 0
  )),
  CHECK (recipient_gstin_applicable = 0 OR gst_mode = 'india_gst'),
  CHECK (reverse_charge = 0 OR gst_mode = 'india_gst'),
  CHECK (gst_mode = 'india_gst' OR (
    supply_type IS NULL AND place_of_supply_state_code IS NULL
    AND place_of_supply_state_name IS NULL AND place_of_supply_country IS NULL
    AND export_reference IS NULL
  )),
  CHECK (gst_mode <> 'india_gst' OR (supply_type IS NOT NULL AND (
    (supply_type = 'domestic' AND place_of_supply_state_code IS NOT NULL
      AND place_of_supply_country IS NULL AND export_reference IS NULL)
    OR (supply_type IN ('export_lut', 'export_igst')
      AND place_of_supply_state_code IS NULL AND place_of_supply_country IS NOT NULL
      AND place_of_supply_country <> 'IN')
  ))),
  CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
  CHECK (
    total_minor = net_subtotal_minor
      + CASE WHEN reverse_charge = 1 THEN 0 ELSE tax_total_minor END
      + round_off_minor
  ),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id, id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_status
  ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_dates
  ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  sac TEXT CHECK (sac IS NULL OR length(sac) <= 64),
  quantity TEXT NOT NULL CHECK (
    length(quantity) > 0 AND quantity GLOB '[0-9]*'
    AND quantity NOT GLOB '*[^0-9.]*' AND quantity NOT LIKE '%.%.%'
  ),
  unit_price TEXT NOT NULL CHECK (
    length(unit_price) > 0 AND unit_price GLOB '[0-9]*'
    AND unit_price NOT GLOB '*[^0-9.]*' AND unit_price NOT LIKE '%.%.%'
  ),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  discount_mode TEXT CHECK (discount_mode IN ('percent', 'fixed')),
  discount_value TEXT CHECK (
    discount_value IS NULL OR (
      length(discount_value) > 0
      AND discount_value GLOB '[0-9]*'
      AND discount_value NOT GLOB '*[^0-9.]*'
      AND discount_value NOT LIKE '%.%.%'
    )
  ),
  line_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_minor >= 0),
  allocated_invoice_discount_minor INTEGER NOT NULL DEFAULT 0
    CHECK (allocated_invoice_discount_minor >= 0),
  net_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_minor >= 0),
  tax_treatment TEXT CHECK (
    tax_treatment IN ('taxable', 'nil_rated', 'exempt', 'non_gst')
  ),
  gst_rate TEXT CHECK (
    gst_rate IS NULL OR (length(gst_rate) > 0 AND gst_rate NOT GLOB '*[^0-9.]*'
      AND gst_rate NOT LIKE '%.%.%' AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100)
  ),
  cgst_rate TEXT CHECK (cgst_rate IS NULL OR (
    length(cgst_rate) > 0 AND cgst_rate NOT GLOB '*[^0-9.]*'
    AND cgst_rate NOT LIKE '%.%.%' AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100
  )),
  sgst_rate TEXT CHECK (sgst_rate IS NULL OR (
    length(sgst_rate) > 0 AND sgst_rate NOT GLOB '*[^0-9.]*'
    AND sgst_rate NOT LIKE '%.%.%' AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100
  )),
  igst_rate TEXT CHECK (igst_rate IS NULL OR (
    length(igst_rate) > 0 AND igst_rate NOT GLOB '*[^0-9.]*'
    AND igst_rate NOT LIKE '%.%.%' AND CAST(igst_rate AS REAL) BETWEEN 0 AND 100
  )),
  cgst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_minor >= 0),
  sgst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_minor >= 0),
  igst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_minor >= 0),
  foreign_tax_label TEXT CHECK (
    foreign_tax_label IS NULL OR length(trim(foreign_tax_label)) BETWEEN 1 AND 80
  ),
  foreign_tax_mode TEXT CHECK (foreign_tax_mode IN ('percent', 'fixed')),
  foreign_tax_rate TEXT CHECK (
    foreign_tax_rate IS NULL OR (
      length(foreign_tax_rate) > 0 AND foreign_tax_rate NOT GLOB '*[^0-9.]*'
      AND foreign_tax_rate NOT LIKE '%.%.%'
      AND CAST(foreign_tax_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  foreign_tax_amount_minor INTEGER NOT NULL DEFAULT 0
    CHECK (foreign_tax_amount_minor >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (line_discount_minor + allocated_invoice_discount_minor <= amount_minor),
  CHECK (discount_mode IS NOT NULL OR (discount_value IS NULL AND line_discount_minor = 0)),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id) ON DELETE CASCADE,
  UNIQUE (invoice_id, position)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);
`);

/**
 * Adds #43's discount and round-off columns to a database created by #42 and backfills net amounts
 * for rows that predate them. The backfill is guarded by the absence of the net columns, so it runs
 * only during the upgrade and never rewrites legitimate discounted rows on later startups. The
 * CHECK constraints above apply only to databases created with the current schema.
 */
export async function migrateInvoiceDiscountColumns(database: typeof db = db): Promise<void> {
  let invoiceNeedsNetBackfill = !(await database.hasColumn(
    getTableReference(invoices),
    'net_subtotal_minor',
  ));
  let lineNeedsNetBackfill = !(await database.hasColumn(
    getTableReference(invoiceLines),
    'net_minor',
  ));

  const invoiceExtraColumns: Array<[string, string]> = [
    ['line_discount_total_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0)'],
    ['invoice_discount_mode', "TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed'))"],
    [
      'invoice_discount_value',
      "TEXT CHECK (invoice_discount_value IS NULL OR (length(invoice_discount_value) > 0 " +
        "AND invoice_discount_value GLOB '[0-9]*' AND invoice_discount_value NOT GLOB '*[^0-9.]*' " +
        "AND invoice_discount_value NOT LIKE '%.%.%'))",
    ],
    ['invoice_discount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0)'],
    ['net_subtotal_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0)'],
    ['round_off_minor', 'INTEGER NOT NULL DEFAULT 0'],
  ];

  for (let [columnName, sqlType] of invoiceExtraColumns) {
    if (!(await database.hasColumn(getTableReference(invoices), columnName))) {
      await database.executeScript(`ALTER TABLE invoices ADD COLUMN ${columnName} ${sqlType};`);
    }
  }

  const invoiceLineExtraColumns: Array<[string, string]> = [
    ['discount_mode', "TEXT CHECK (discount_mode IN ('percent', 'fixed'))"],
    [
      'discount_value',
      "TEXT CHECK (discount_value IS NULL OR (length(discount_value) > 0 " +
        "AND discount_value GLOB '[0-9]*' AND discount_value NOT GLOB '*[^0-9.]*' " +
        "AND discount_value NOT LIKE '%.%.%'))",
    ],
    ['line_discount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_minor >= 0)'],
    [
      'allocated_invoice_discount_minor',
      'INTEGER NOT NULL DEFAULT 0 CHECK (allocated_invoice_discount_minor >= 0)',
    ],
    ['net_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (net_minor >= 0)'],
  ];

  for (let [columnName, sqlType] of invoiceLineExtraColumns) {
    if (!(await database.hasColumn(getTableReference(invoiceLines), columnName))) {
      await database.executeScript(`ALTER TABLE invoice_lines ADD COLUMN ${columnName} ${sqlType};`);
    }
  }

  if (invoiceNeedsNetBackfill) {
    await database.executeScript('UPDATE invoices SET net_subtotal_minor = subtotal_minor;');
  }
  if (lineNeedsNetBackfill) {
    await database.executeScript('UPDATE invoice_lines SET net_minor = amount_minor;');
  }
}

await migrateInvoiceDiscountColumns();

/**
 * Adds domestic GST fields to existing Draft tables. SQLite cannot drop #43's total check in
 * place, so the invoice table is rebuilt once with its original data and the tax-aware invariant.
 */
export async function migrateInvoiceTaxColumns(database: typeof db = db): Promise<void> {
  let invoiceTable = getTableReference(invoices);
  let invoiceHasGstMode = await database.hasColumn(invoiceTable, 'gst_mode');
  if (!invoiceHasGstMode) {
    await database.executeScript(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE invoices_with_gst (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'credit_note')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft')),
        invoice_number TEXT CHECK (
          invoice_number IS NULL OR (status <> 'draft' AND length(trim(invoice_number)) > 0)
        ),
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        invoice_date TEXT NOT NULL CHECK (
          invoice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        due_date TEXT NOT NULL CHECK (
          due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        payment_term TEXT NOT NULL CHECK (payment_term IN (
          'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
        )),
        custom_payment_terms TEXT CHECK (custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200),
        recipient_legal_name TEXT NOT NULL CHECK (length(trim(recipient_legal_name)) > 0),
        recipient_billing_line1 TEXT,
        recipient_billing_locality TEXT,
        recipient_billing_region TEXT,
        recipient_billing_postal_code TEXT,
        recipient_billing_country TEXT,
        recipient_tax_country TEXT,
        recipient_tax_type TEXT,
        recipient_tax_value TEXT,
        recipient_tax_state_name TEXT,
        recipient_tax_state_code TEXT,
        gst_mode TEXT NOT NULL DEFAULT 'none' CHECK (gst_mode IN ('none', 'india_gst')),
        place_of_supply_state_code TEXT,
        place_of_supply_state_name TEXT,
        recipient_gstin_applicable INTEGER NOT NULL DEFAULT 0 CHECK (recipient_gstin_applicable IN (0, 1)),
        payment_instructions TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000),
        customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000),
        internal_note TEXT CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
        subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
        line_discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0),
        invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed')),
        invoice_discount_value TEXT CHECK (
          invoice_discount_value IS NULL OR (
            length(invoice_discount_value) > 0
            AND invoice_discount_value GLOB '[0-9]*'
            AND invoice_discount_value NOT GLOB '*[^0-9.]*'
            AND invoice_discount_value NOT LIKE '%.%.%'
          )
        ),
        invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0),
        net_subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0),
        tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
        round_off_minor INTEGER NOT NULL DEFAULT 0,
        total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (invoice_discount_mode IS NOT NULL OR (
          invoice_discount_value IS NULL AND invoice_discount_minor = 0
        )),
        CHECK (recipient_gstin_applicable = 0 OR gst_mode = 'india_gst'),
        CHECK (gst_mode = 'india_gst' OR (
          place_of_supply_state_code IS NULL AND place_of_supply_state_name IS NULL
        )),
        CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
        CHECK (total_minor = net_subtotal_minor + tax_total_minor + round_off_minor),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
      );
      INSERT INTO invoices_with_gst (
        id, organization_id, client_id, document_type, status, invoice_number, currency,
        invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
        recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
        recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
        recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
        payment_instructions, customer_notes, internal_note, subtotal_minor,
        line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
        invoice_discount_minor, net_subtotal_minor, round_off_minor, total_minor, created_at, updated_at
      )
      SELECT
        id, organization_id, client_id, document_type, status, invoice_number, currency,
        invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
        recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
        recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
        recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
        payment_instructions, customer_notes, internal_note, subtotal_minor,
        line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
        invoice_discount_minor, net_subtotal_minor, round_off_minor, total_minor, created_at, updated_at
      FROM invoices;
      DROP TABLE invoices;
      ALTER TABLE invoices_with_gst RENAME TO invoices;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id, id);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_status ON invoices(organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_dates
        ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);
      PRAGMA foreign_keys = ON;
    `);
  }

  let invoiceColumns: Array<[string, string]> = [
    ["gst_mode", "TEXT NOT NULL DEFAULT 'none' CHECK (gst_mode IN ('none', 'india_gst'))"],
    ['place_of_supply_state_code', 'TEXT'],
    ['place_of_supply_state_name', 'TEXT'],
    ['recipient_gstin_applicable', 'INTEGER NOT NULL DEFAULT 0 CHECK (recipient_gstin_applicable IN (0, 1))'],
    ['tax_total_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0)'],
  ];
  for (let [columnName, sqlType] of invoiceColumns) {
    if (!(await database.hasColumn(invoiceTable, columnName))) {
      await database.executeScript(`ALTER TABLE invoices ADD COLUMN ${columnName} ${sqlType};`);
    }
  }

  let lineColumns: Array<[string, string]> = [
    ['tax_treatment', "TEXT CHECK (tax_treatment IN ('taxable', 'nil_rated', 'exempt', 'non_gst'))"],
    [
      'gst_rate',
      "TEXT CHECK (gst_rate IS NULL OR (length(gst_rate) > 0 AND gst_rate NOT GLOB '*[^0-9.]*' " +
        "AND gst_rate NOT LIKE '%.%.%' AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'cgst_rate',
      "TEXT CHECK (cgst_rate IS NULL OR (length(cgst_rate) > 0 AND cgst_rate NOT GLOB '*[^0-9.]*' " +
        "AND cgst_rate NOT LIKE '%.%.%' AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'sgst_rate',
      "TEXT CHECK (sgst_rate IS NULL OR (length(sgst_rate) > 0 AND sgst_rate NOT GLOB '*[^0-9.]*' " +
        "AND sgst_rate NOT LIKE '%.%.%' AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'igst_rate',
      "TEXT CHECK (igst_rate IS NULL OR (length(igst_rate) > 0 AND igst_rate NOT GLOB '*[^0-9.]*' " +
        "AND igst_rate NOT LIKE '%.%.%' AND CAST(igst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    ['cgst_amount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_minor >= 0)'],
    ['sgst_amount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_minor >= 0)'],
    ['igst_amount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_minor >= 0)'],
  ];
  for (let [columnName, sqlType] of lineColumns) {
    if (!(await database.hasColumn(getTableReference(invoiceLines), columnName))) {
      await database.executeScript(`ALTER TABLE invoice_lines ADD COLUMN ${columnName} ${sqlType};`);
    }
  }
}

await migrateInvoiceTaxColumns();

/**
 * Adds #46's export/foreign-tax fields and reverse-charge total invariant. Older Draft invoice
 * tables need a rebuild because SQLite cannot alter the existing GST-mode and total CHECKs.
 */
export async function migrateInvoiceExtendedTaxColumns(database: typeof db = db): Promise<void> {
  let invoiceTable = getTableReference(invoices);
  if (!(await database.hasColumn(invoiceTable, 'supply_type'))) {
    await database.executeScript(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE invoices_with_extended_tax (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'credit_note')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft')),
        invoice_number TEXT CHECK (
          invoice_number IS NULL OR (status <> 'draft' AND length(trim(invoice_number)) > 0)
        ),
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        invoice_date TEXT NOT NULL CHECK (
          invoice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        due_date TEXT NOT NULL CHECK (
          due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        payment_term TEXT NOT NULL CHECK (payment_term IN (
          'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
        )),
        custom_payment_terms TEXT CHECK (custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200),
        recipient_legal_name TEXT NOT NULL CHECK (length(trim(recipient_legal_name)) > 0),
        recipient_billing_line1 TEXT,
        recipient_billing_locality TEXT,
        recipient_billing_region TEXT,
        recipient_billing_postal_code TEXT,
        recipient_billing_country TEXT,
        recipient_tax_country TEXT,
        recipient_tax_type TEXT,
        recipient_tax_value TEXT,
        recipient_tax_state_name TEXT,
        recipient_tax_state_code TEXT,
        gst_mode TEXT NOT NULL DEFAULT 'none' CHECK (
          gst_mode IN ('none', 'india_gst', 'foreign_manual')
        ),
        supply_type TEXT CHECK (supply_type IN ('domestic', 'export_lut', 'export_igst')),
        place_of_supply_state_code TEXT,
        place_of_supply_state_name TEXT,
        place_of_supply_country TEXT,
        recipient_gstin_applicable INTEGER NOT NULL DEFAULT 0 CHECK (recipient_gstin_applicable IN (0, 1)),
        reverse_charge INTEGER NOT NULL DEFAULT 0 CHECK (reverse_charge IN (0, 1)),
        export_reference TEXT CHECK (export_reference IS NULL OR length(export_reference) <= 200),
        payment_instructions TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000),
        customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000),
        internal_note TEXT CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
        subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
        line_discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0),
        invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed')),
        invoice_discount_value TEXT CHECK (
          invoice_discount_value IS NULL OR (
            length(invoice_discount_value) > 0
            AND invoice_discount_value GLOB '[0-9]*'
            AND invoice_discount_value NOT GLOB '*[^0-9.]*'
            AND invoice_discount_value NOT LIKE '%.%.%'
          )
        ),
        invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0),
        net_subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0),
        tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
        round_off_minor INTEGER NOT NULL DEFAULT 0,
        total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (invoice_discount_mode IS NOT NULL OR (
          invoice_discount_value IS NULL AND invoice_discount_minor = 0
        )),
        CHECK (recipient_gstin_applicable = 0 OR gst_mode = 'india_gst'),
        CHECK (reverse_charge = 0 OR gst_mode = 'india_gst'),
        CHECK (gst_mode = 'india_gst' OR (
          supply_type IS NULL AND place_of_supply_state_code IS NULL
          AND place_of_supply_state_name IS NULL AND place_of_supply_country IS NULL
          AND export_reference IS NULL
        )),
        CHECK (gst_mode <> 'india_gst' OR (supply_type IS NOT NULL AND (
          (supply_type = 'domestic' AND place_of_supply_state_code IS NOT NULL
            AND place_of_supply_country IS NULL AND export_reference IS NULL)
          OR (supply_type IN ('export_lut', 'export_igst')
            AND place_of_supply_state_code IS NULL AND place_of_supply_country IS NOT NULL
            AND place_of_supply_country <> 'IN')
        ))),
        CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
        CHECK (
          total_minor = net_subtotal_minor
            + CASE WHEN reverse_charge = 1 THEN 0 ELSE tax_total_minor END
            + round_off_minor
        ),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
      );
      INSERT INTO invoices_with_extended_tax (
        id, organization_id, client_id, document_type, status, invoice_number, currency,
        invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
        recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
        recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
        recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
        gst_mode, supply_type, place_of_supply_state_code, place_of_supply_state_name,
        recipient_gstin_applicable, payment_instructions, customer_notes, internal_note,
        subtotal_minor, line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
        invoice_discount_minor, net_subtotal_minor, tax_total_minor, round_off_minor, total_minor,
        created_at, updated_at
      )
      SELECT
        id, organization_id, client_id, document_type, status, invoice_number, currency,
        invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
        recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
        recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
        recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
        gst_mode, CASE WHEN gst_mode = 'india_gst' THEN 'domestic' ELSE NULL END,
        place_of_supply_state_code, place_of_supply_state_name, recipient_gstin_applicable,
        payment_instructions, customer_notes, internal_note, subtotal_minor,
        line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
        invoice_discount_minor, net_subtotal_minor, tax_total_minor, round_off_minor, total_minor,
        created_at, updated_at
      FROM invoices;
      DROP TABLE invoices;
      ALTER TABLE invoices_with_extended_tax RENAME TO invoices;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id, id);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_status ON invoices(organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_dates
        ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);
      PRAGMA foreign_keys = ON;
    `);
  }

  let lineTable = getTableReference(invoiceLines);
  const lineColumns: Array<[string, string]> = [
    [
      'foreign_tax_label',
      'TEXT CHECK (foreign_tax_label IS NULL OR length(trim(foreign_tax_label)) BETWEEN 1 AND 80)',
    ],
    ['foreign_tax_mode', "TEXT CHECK (foreign_tax_mode IN ('percent', 'fixed'))"],
    [
      'foreign_tax_rate',
      "TEXT CHECK (foreign_tax_rate IS NULL OR (length(foreign_tax_rate) > 0 " +
        "AND foreign_tax_rate NOT GLOB '*[^0-9.]*' AND foreign_tax_rate NOT LIKE '%.%.%' " +
        'AND CAST(foreign_tax_rate AS REAL) BETWEEN 0 AND 100))',
    ],
    ['foreign_tax_amount_minor', 'INTEGER NOT NULL DEFAULT 0 CHECK (foreign_tax_amount_minor >= 0)'],
  ];
  for (let [columnName, sqlType] of lineColumns) {
    if (!(await database.hasColumn(lineTable, columnName))) {
      await database.executeScript(`ALTER TABLE invoice_lines ADD COLUMN ${columnName} ${sqlType};`);
    }
  }
}

await migrateInvoiceExtendedTaxColumns();

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

// #40 extends the #39 profile with tax registration columns. Guard each ALTER so a database
// created by an earlier ticket upgrades in place; CHECK constraints apply to fresh databases.
const invoicingExtraColumns: Array<[string, string]> = [
  ['pan', 'TEXT'],
  ['gst_registered', 'INTEGER NOT NULL DEFAULT 0 CHECK (gst_registered IN (0, 1))'],
  ['gstin', 'TEXT'],
  ['gst_state_code', 'TEXT'],
  ['gst_state_name', 'TEXT'],
  ['default_currency', "TEXT NOT NULL DEFAULT 'INR' CHECK (default_currency GLOB '[A-Z][A-Z][A-Z]')"],
  [
    'payment_term',
    "TEXT NOT NULL DEFAULT 'due_on_receipt' CHECK (payment_term IN (" +
      "'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'))",
  ],
  ['custom_payment_terms', 'TEXT CHECK (custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200)'],
  ['payment_instructions', 'TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000)'],
  ['customer_notes', 'TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000)'],
  [
    'invoice_prefix',
    "TEXT NOT NULL DEFAULT 'INV' CHECK (length(invoice_prefix) BETWEEN 1 AND 12 " +
      "AND invoice_prefix NOT GLOB '*[/]*' AND invoice_prefix NOT GLOB '*[^A-Z0-9_-]*')",
  ],
  ['invoice_starting_number', 'INTEGER NOT NULL DEFAULT 1 CHECK (invoice_starting_number >= 1)'],
  [
    'credit_note_prefix',
    "TEXT NOT NULL DEFAULT 'CN' CHECK (length(credit_note_prefix) BETWEEN 1 AND 12 " +
      "AND credit_note_prefix NOT GLOB '*[/]*' AND credit_note_prefix NOT GLOB '*[^A-Z0-9_-]*')",
  ],
  [
    'credit_note_starting_number',
    'INTEGER NOT NULL DEFAULT 1 CHECK (credit_note_starting_number >= 1)',
  ],
  [
    'logo_data_url',
    "TEXT CHECK (logo_data_url IS NULL OR (length(logo_data_url) <= 175000 AND (" +
      "logo_data_url GLOB 'data:image/png;base64,*' OR " +
      "logo_data_url GLOB 'data:image/jpeg;base64,*' OR " +
      "logo_data_url GLOB 'data:image/webp;base64,*')))",
  ],
  [
    'signature_data_url',
    "TEXT CHECK (signature_data_url IS NULL OR (length(signature_data_url) <= 175000 AND (" +
      "signature_data_url GLOB 'data:image/png;base64,*' OR " +
      "signature_data_url GLOB 'data:image/jpeg;base64,*' OR " +
      "signature_data_url GLOB 'data:image/webp;base64,*')))",
  ],
  ['signatory_name', 'TEXT CHECK (signatory_name IS NULL OR length(signatory_name) <= 120)'],
  [
    'signatory_designation',
    'TEXT CHECK (signatory_designation IS NULL OR length(signatory_designation) <= 100)',
  ],
];

for (let [columnName, sqlType] of invoicingExtraColumns) {
  if (!(await db.hasColumn(getTableReference(organizationInvoicingProfiles), columnName))) {
    await db.executeScript(
      `ALTER TABLE organization_invoicing_profiles ADD COLUMN ${columnName} ${sqlType};`,
    );
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
export type OrganizationInvoicingProfile = TableRow<typeof organizationInvoicingProfiles>;
export type OrganizationGstRatePreset = TableRow<typeof organizationGstRatePresets>;
export type OrganizationMembership = TableRow<typeof organizationMemberships>;
export type UserPassword = TableRow<typeof userPasswords>;
export type SessionRow = TableRow<typeof sessions>;
export type Client = TableRow<typeof clients>;
export type Invoice = TableRow<typeof invoices>;
export type InvoiceLine = TableRow<typeof invoiceLines>;
