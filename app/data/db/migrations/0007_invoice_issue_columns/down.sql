-- data-table/transaction: none
-- Reverts 0007: rebuilds the invoices table at its 0005 shape (draft-only lifecycle, no
-- seller snapshots), removes the invoice-number index, and drops document_sequences. Issued
-- rows cannot survive the draft-only CHECK and fail the copy loudly instead of corrupting.

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
  place_of_supply_country, recipient_gstin_applicable, reverse_charge, export_reference,
  payment_instructions, customer_notes, internal_note, subtotal_minor,
  line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
  invoice_discount_minor, net_subtotal_minor, tax_total_minor, round_off_minor, total_minor,
  created_at, updated_at
)
SELECT
  id, organization_id, client_id, document_type, status, invoice_number, currency,
  invoice_date, due_date, payment_term, custom_payment_terms, recipient_legal_name,
  recipient_billing_line1, recipient_billing_locality, recipient_billing_region,
  recipient_billing_postal_code, recipient_billing_country, recipient_tax_country,
  recipient_tax_type, recipient_tax_value, recipient_tax_state_name, recipient_tax_state_code,
  gst_mode, supply_type, place_of_supply_state_code, place_of_supply_state_name,
  place_of_supply_country, recipient_gstin_applicable, reverse_charge, export_reference,
  payment_instructions, customer_notes, internal_note, subtotal_minor,
  line_discount_total_minor, invoice_discount_mode, invoice_discount_value,
  invoice_discount_minor, net_subtotal_minor, tax_total_minor, round_off_minor, total_minor,
  created_at, updated_at
FROM invoices;
DROP TABLE invoices;
ALTER TABLE invoices_with_extended_tax RENAME TO invoices;
CREATE UNIQUE INDEX idx_invoices_organization_id ON invoices(organization_id, id);
CREATE INDEX idx_invoices_organization_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_organization_dates
  ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);
-- idx_invoices_organization_invoice_number died implicitly with the dropped invoices table;
-- the pre-0007 schema had no such index, so nothing is recreated here.
PRAGMA foreign_keys = ON;

DROP TABLE document_sequences;
