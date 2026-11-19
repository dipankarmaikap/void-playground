-- data-table/transaction: none
-- Reverts 0004: rebuilds the invoices table at its post-0003 shape (the #42 CREATE plus the
-- ALTER-appended discount columns, with no tax-aware table CHECKs) and drops the line columns.

PRAGMA foreign_keys = OFF;

CREATE TABLE invoices_pre_gst (
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
  payment_instructions TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000),
  customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000),
  internal_note TEXT CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
  subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
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
  round_off_minor INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
);
INSERT INTO invoices_pre_gst (
  id, organization_id, client_id, document_type, status, invoice_number, currency,
  invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
  recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
  recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
  recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
  payment_instructions, customer_notes, internal_note, subtotal_minor, total_minor,
  created_at, updated_at,
  line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
  invoice_discount_minor, net_subtotal_minor, round_off_minor
)
SELECT
  id, organization_id, client_id, document_type, status, invoice_number, currency,
  invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
  recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
  recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
  recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
  payment_instructions, customer_notes, internal_note, subtotal_minor, total_minor,
  created_at, updated_at,
  line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
  invoice_discount_minor, net_subtotal_minor, round_off_minor
FROM invoices;
DROP TABLE invoices;
ALTER TABLE invoices_pre_gst RENAME TO invoices;
CREATE UNIQUE INDEX idx_invoices_organization_id ON invoices(organization_id, id);
CREATE INDEX idx_invoices_organization_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_organization_dates
  ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);
PRAGMA foreign_keys = ON;

ALTER TABLE invoice_lines DROP COLUMN igst_amount_minor;
ALTER TABLE invoice_lines DROP COLUMN sgst_amount_minor;
ALTER TABLE invoice_lines DROP COLUMN cgst_amount_minor;
ALTER TABLE invoice_lines DROP COLUMN igst_rate;
ALTER TABLE invoice_lines DROP COLUMN sgst_rate;
ALTER TABLE invoice_lines DROP COLUMN cgst_rate;
ALTER TABLE invoice_lines DROP COLUMN gst_rate;
ALTER TABLE invoice_lines DROP COLUMN tax_treatment;
