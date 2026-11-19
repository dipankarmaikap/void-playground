-- #42 adds Organization-scoped invoices with same-Organization composite foreign keys. SQLite
-- requires the composite-FK parent key to be unique, so the matching indexes are created
-- alongside the tables. The invoice tables are at their #42-era shape: draft-only status and no
-- discount, tax, or issue columns (0003-0007 add those). document_sequences and the
-- invoice-number index belong to the issue-flow step (0007), not here.

CREATE UNIQUE INDEX idx_clients_organization_id ON clients(organization_id, id);

CREATE TABLE invoices (
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
);

CREATE UNIQUE INDEX idx_invoices_organization_id ON invoices(organization_id, id);
CREATE INDEX idx_invoices_organization_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_organization_dates
  ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);

CREATE TABLE invoice_lines (
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id) ON DELETE CASCADE,
  UNIQUE (invoice_id, position)
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);

CREATE TABLE invoice_pdf_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  data BLOB NOT NULL CHECK (length(data) > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
    ON DELETE CASCADE,
  UNIQUE (organization_id, invoice_id)
);
