import { getTableReference } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import {
  clients,
  creditNotes,
  invoiceLines,
  invoices,
  organizationInvoicingProfiles,
  users,
} from './tables.ts';

/**
 * Adds #43's discount and round-off columns to a database created by #42 and backfills net amounts
 * for rows that predate them. The backfill is guarded by the absence of the net columns, so it runs
 * only during the upgrade and never rewrites legitimate discounted rows on later startups. The
 * CHECK constraints in the fresh-install schema apply only to databases created with it.
 */
export async function migrateInvoiceDiscountColumns(database: SqliteDatabase): Promise<void> {
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

/**
 * Adds domestic GST fields to existing Draft tables. SQLite cannot drop #43's total check in
 * place, so the invoice table is rebuilt once with its original data and the tax-aware invariant.
 */
export async function migrateInvoiceTaxColumns(database: SqliteDatabase): Promise<void> {
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
      "TEXT CHECK (gst_rate IS NULL OR (length(gst_rate) > 0 AND gst_rate GLOB '*[0-9]*' " +
        "AND gst_rate NOT GLOB '*[^0-9.]*' " +
        "AND gst_rate NOT LIKE '%.%.%' AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'cgst_rate',
      "TEXT CHECK (cgst_rate IS NULL OR (length(cgst_rate) > 0 AND cgst_rate GLOB '*[0-9]*' " +
        "AND cgst_rate NOT GLOB '*[^0-9.]*' " +
        "AND cgst_rate NOT LIKE '%.%.%' AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'sgst_rate',
      "TEXT CHECK (sgst_rate IS NULL OR (length(sgst_rate) > 0 AND sgst_rate GLOB '*[0-9]*' " +
        "AND sgst_rate NOT GLOB '*[^0-9.]*' " +
        "AND sgst_rate NOT LIKE '%.%.%' AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100))",
    ],
    [
      'igst_rate',
      "TEXT CHECK (igst_rate IS NULL OR (length(igst_rate) > 0 AND igst_rate GLOB '*[0-9]*' " +
        "AND igst_rate NOT GLOB '*[^0-9.]*' " +
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

/**
 * Adds #46's export/foreign-tax fields and reverse-charge total invariant. Older Draft invoice
 * tables need a rebuild because SQLite cannot alter the existing GST-mode and total CHECKs.
 */
export async function migrateInvoiceExtendedTaxColumns(database: SqliteDatabase): Promise<void> {
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
        "AND foreign_tax_rate GLOB '*[0-9]*' AND foreign_tax_rate NOT GLOB '*[^0-9.]*' " +
        "AND foreign_tax_rate NOT LIKE '%.%.%' " +
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

/**
 * Tightens the existing invoice-line rate CHECK constraints without discarding saved data. A lone
 * decimal point was previously accepted and SQLite interpreted it as numeric zero; canonicalize
 * only that malformed representation before copying so its prior numeric meaning is preserved.
 */
export async function migrateInvoiceTaxRateConstraints(database: SqliteDatabase): Promise<void> {
  let result = await database.exec(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoice_lines'",
  );
  let row = result.rows?.[0] as { sql?: unknown } | undefined;
  let schemaSql = typeof row?.sql === 'string' ? row.sql : '';
  let rateColumns = ['gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'foreign_tax_rate'];
  if (rateColumns.every((column) => schemaSql.includes(`${column} GLOB '*[0-9]*'`))) return;

  let strengthenedSchema = schemaSql.replace(
    /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?invoice_lines["'`]?\s*\(/i,
    'CREATE TABLE invoice_lines_with_valid_tax_rates (',
  );
  if (strengthenedSchema === schemaSql) {
    throw new Error('Unable to rebuild the invoice_lines table for tax-rate constraint migration.');
  }
  for (let column of rateColumns) {
    if (strengthenedSchema.includes(`${column} GLOB '*[0-9]*'`)) continue;
    let checkPattern = new RegExp(
      `(length\\(${column}\\)\\s*>\\s*0\\s+AND\\s+)(${column}\\s+NOT\\s+GLOB)`,
      'i',
    );
    let updatedSchema = strengthenedSchema.replace(
      checkPattern,
      `$1${column} GLOB '*[0-9]*' AND $2`,
    );
    if (updatedSchema === strengthenedSchema) {
      throw new Error(`Unable to strengthen the ${column} CHECK constraint.`);
    }
    strengthenedSchema = updatedSchema;
  }

  await database.executeScript('BEGIN IMMEDIATE;');
  try {
    await database.executeScript(strengthenedSchema);
    await database.executeScript(`
      UPDATE invoice_lines
      SET gst_rate = CASE WHEN gst_rate = '.' THEN '0' ELSE gst_rate END,
          cgst_rate = CASE WHEN cgst_rate = '.' THEN '0' ELSE cgst_rate END,
          sgst_rate = CASE WHEN sgst_rate = '.' THEN '0' ELSE sgst_rate END,
          igst_rate = CASE WHEN igst_rate = '.' THEN '0' ELSE igst_rate END,
          foreign_tax_rate = CASE
            WHEN foreign_tax_rate = '.' THEN '0'
            ELSE foreign_tax_rate
          END;
      INSERT INTO invoice_lines_with_valid_tax_rates
        SELECT * FROM invoice_lines;
      DROP TABLE invoice_lines;
      ALTER TABLE invoice_lines_with_valid_tax_rates RENAME TO invoice_lines;
      CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);
    `);
    await database.executeScript('COMMIT;');
  } catch (error) {
    await database.executeScript('ROLLBACK;');
    throw error;
  }
}

// The issue-time snapshot columns and their CHECK constraints are deliberately declared in three
// places: this list (legacy ALTER TABLE backfills), `invoiceIssueChecks` (the legacy table rebuild
// inside `migrateInvoiceIssueColumns`), and the fresh-install CREATE TABLE for `invoices` in
// `./schema.ts`. The CHECKs encode cross-column lifecycle invariants rather than per-column types,
// so they cannot be derived from the column list; keep all three declarations in sync when
// snapshot columns change.
const invoiceIssueColumns: Array<[string, string]> = [
  ['issued_at', 'INTEGER'],
  ['seller_legal_name', 'TEXT'],
  ['seller_address_line1', 'TEXT'],
  ['seller_address_locality', 'TEXT'],
  ['seller_address_region', 'TEXT'],
  ['seller_address_postal_code', 'TEXT'],
  ['seller_country', 'TEXT'],
  ['seller_email', 'TEXT'],
  ['seller_phone', 'TEXT'],
  ['seller_pan', 'TEXT'],
  ['seller_gst_registered', 'INTEGER NOT NULL DEFAULT 0 CHECK (seller_gst_registered IN (0, 1))'],
  ['seller_gstin', 'TEXT'],
  ['seller_gst_state_code', 'TEXT'],
  ['seller_gst_state_name', 'TEXT'],
  ['seller_logo_data_url', 'TEXT'],
  ['seller_signature_data_url', 'TEXT'],
  ['seller_signatory_name', 'TEXT'],
  ['seller_signatory_designation', 'TEXT'],
];

const invoiceIssueChecks = `
  CHECK (
    (status = 'draft' AND invoice_number IS NULL AND issued_at IS NULL)
    OR (
      status = 'issued' AND invoice_number IS NOT NULL
      AND length(trim(invoice_number)) > 0 AND issued_at IS NOT NULL
    )
  ),
  CHECK (status <> 'issued' OR (
    seller_legal_name IS NOT NULL AND length(trim(seller_legal_name)) > 0
    AND seller_address_line1 IS NOT NULL AND length(trim(seller_address_line1)) > 0
    AND seller_country IS NOT NULL AND length(trim(seller_country)) > 0
  )),
  CHECK (status <> 'issued' OR seller_gst_registered = 0 OR (
    seller_gstin IS NOT NULL AND length(seller_gstin) = 15
    AND seller_gst_state_code IS NOT NULL AND length(seller_gst_state_code) = 2
    AND seller_gst_state_name IS NOT NULL AND length(trim(seller_gst_state_name)) > 0
  )),
`;

function quoteSqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Adds issue-time seller snapshots, lifecycle state, numbering constraints, and sequence storage. */
export async function migrateInvoiceIssueColumns(database: SqliteDatabase): Promise<void> {
  await database.executeScript(`
    CREATE TABLE IF NOT EXISTS document_sequences (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'credit_note')),
      financial_year TEXT NOT NULL CHECK (financial_year GLOB '[0-9][0-9]-[0-9][0-9]'),
      current_number INTEGER NOT NULL CHECK (current_number BETWEEN 1 AND 9007199254740991),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE (organization_id, document_type, financial_year)
    );
  `);

  let invoiceTable = getTableReference(invoices);
  let schemaResult = await database.exec(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoices'",
  );
  let schemaRow = schemaResult.rows?.[0] as { sql?: unknown } | undefined;
  let schemaSql = typeof schemaRow?.sql === 'string' ? schemaRow.sql : '';
  if (!schemaSql) {
    throw new Error('Unable to read the invoices table schema for the issue-flow migration.');
  }

  if (!schemaSql.includes("status IN ('draft', 'issued')")) {
    let columnResult = await database.exec('PRAGMA table_info(invoices)');
    let existingColumns = (columnResult.rows ?? [])
      .map((row) => (row as { name?: unknown }).name)
      .filter((name): name is string => typeof name === 'string');
    let issueColumnsToAdd = invoiceIssueColumns.filter(
      ([columnName]) => !existingColumns.includes(columnName),
    );
    let renamedSchema = schemaSql.replace(
      /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?invoices["'`]?\s*\(/i,
      'CREATE TABLE invoices_with_issue_state (',
    );
    let statusSchema = renamedSchema.replace(
      /CHECK\s*\(\s*status\s+IN\s*\(\s*'draft'\s*\)\s*\)/i,
      "CHECK (status IN ('draft', 'issued'))",
    );
    if (statusSchema === renamedSchema || statusSchema === schemaSql) {
      throw new Error(
        'Unable to rebuild the invoices table for issued invoices: no legacy status CHECK matched.',
      );
    }

    let issueColumnSchema = statusSchema;
    if (issueColumnsToAdd.length > 0) {
      let definitions = issueColumnsToAdd.map(
        ([columnName, definition]) => `${columnName} ${definition}`,
      );
      let updatedSchema = issueColumnSchema.replace(
        /(\bupdated_at\s+INTEGER\s+NOT\s+NULL,)/i,
        `$1\n  ${definitions.join(',\n  ')},`,
      );
      if (updatedSchema === issueColumnSchema) {
        throw new Error(
          'Unable to add the issue-time seller snapshot columns to the invoices table.',
        );
      }
      issueColumnSchema = updatedSchema;
    }
    let checkedSchema = issueColumnSchema.replace(
      /(\s+FOREIGN KEY\s+\(organization_id\)\s+REFERENCES\s+organizations\(id\)\s+ON DELETE CASCADE,)/i,
      `${invoiceIssueChecks}$1`,
    );
    if (checkedSchema === issueColumnSchema) {
      throw new Error('Unable to add the issue-flow CHECK constraints to the invoices table.');
    }

    let oldColumns = existingColumns.map(quoteSqlIdentifier).join(', ');
    await database.executeScript(`
      PRAGMA foreign_keys = OFF;
      ${checkedSchema};
      INSERT INTO invoices_with_issue_state (${oldColumns})
        SELECT ${oldColumns} FROM invoices;
      DROP TABLE invoices;
      ALTER TABLE invoices_with_issue_state RENAME TO invoices;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_id
        ON invoices(organization_id, id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_invoice_number
        ON invoices(organization_id, invoice_number);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_status
        ON invoices(organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_dates
        ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);
      PRAGMA foreign_keys = ON;
    `);
  }

  for (let [columnName, sqlType] of invoiceIssueColumns) {
    if (!(await database.hasColumn(invoiceTable, columnName))) {
      await database.executeScript(`ALTER TABLE invoices ADD COLUMN ${columnName} ${sqlType};`);
    }
  }
  await database.executeScript(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_invoice_number
      ON invoices(organization_id, invoice_number);
  `);
}

/**
 * Carries the original invoice's frozen discount mode onto Credit Notes so their PDFs label the
 * credited invoice discount correctly instead of assuming a fixed amount. Existing notes are
 * backfilled from their parent invoice when the column is first added.
 */
export async function migrateCreditNoteDiscountModeColumn(
  database: SqliteDatabase,
): Promise<void> {
  let creditNoteTable = getTableReference(creditNotes);
  if (await database.hasColumn(creditNoteTable, 'invoice_discount_mode')) return;
  await database.executeScript(
    "ALTER TABLE credit_notes ADD COLUMN invoice_discount_mode " +
      "TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed'));",
  );
  await database.executeScript(`
    UPDATE credit_notes
    SET invoice_discount_mode = (
      SELECT parent.invoice_discount_mode FROM invoices AS parent
      WHERE parent.organization_id = credit_notes.organization_id
        AND parent.id = credit_notes.invoice_id
    );
  `);
}

/** Adds the users display_name column to databases created before it existed. */
export async function migrateUserDisplayNameColumn(database: SqliteDatabase): Promise<void> {
  if (!(await database.hasColumn(getTableReference(users), 'display_name'))) {
    await database.executeScript('ALTER TABLE users ADD COLUMN display_name TEXT;');
  }
}

// Later Client tickets are expected to add nullable columns. Keep each ALTER guarded so an
// existing database never fails on a column it already has, and add one statement at a time.
export async function migrateClientColumns(database: SqliteDatabase): Promise<void> {
  const clientExtraColumns: Array<[string, string]> = [];

  for (let [columnName, sqlType] of clientExtraColumns) {
    if (!(await database.hasColumn(getTableReference(clients), columnName))) {
      await database.executeScript(`ALTER TABLE clients ADD COLUMN ${columnName} ${sqlType};`);
    }
  }
}

// #40 extends the #39 profile with tax registration columns. Guard each ALTER so a database
// created by an earlier ticket upgrades in place; CHECK constraints apply to fresh databases.
export async function migrateInvoicingProfileColumns(database: SqliteDatabase): Promise<void> {
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
    if (!(await database.hasColumn(getTableReference(organizationInvoicingProfiles), columnName))) {
      await database.executeScript(
        `ALTER TABLE organization_invoicing_profiles ADD COLUMN ${columnName} ${sqlType};`,
      );
    }
  }
}
