-- #50 stores linked Credit Notes, their credited source lines, and immutable issue-time PDFs.
-- The unique index on invoice_lines(organization_id, id, invoice_id) makes the composite parent
-- key referenceable by credit_note_lines. The table is at its #50-era shape: the frozen
-- invoice discount mode arrives with 0011.

CREATE UNIQUE INDEX idx_invoice_lines_org_line_invoice
  ON invoice_lines(organization_id, id, invoice_id);

CREATE TABLE credit_notes (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'issued')),
  credit_note_number TEXT,
  credit_date TEXT NOT NULL CHECK (
    credit_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  reason TEXT NOT NULL CHECK (
    length(trim(reason, ' ' || char(9) || char(10) || char(11) || char(12) || char(13)))
      BETWEEN 1 AND 1000
  ),
  issued_at INTEGER,
  subtotal_minor INTEGER NOT NULL CHECK (
    subtotal_minor BETWEEN 0 AND 9007199254740991
  ),
  line_discount_total_minor INTEGER NOT NULL CHECK (
    line_discount_total_minor BETWEEN 0 AND 9007199254740991
  ),
  invoice_discount_minor INTEGER NOT NULL CHECK (
    invoice_discount_minor BETWEEN 0 AND 9007199254740991
  ),
  net_subtotal_minor INTEGER NOT NULL CHECK (
    net_subtotal_minor BETWEEN 0 AND 9007199254740991
  ),
  tax_total_minor INTEGER NOT NULL CHECK (
    tax_total_minor BETWEEN 0 AND 9007199254740991
  ),
  round_off_minor INTEGER NOT NULL CHECK (
    round_off_minor BETWEEN -9007199254740991 AND 9007199254740991
  ),
  total_minor INTEGER NOT NULL CHECK (total_minor BETWEEN 1 AND 9007199254740991),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
  CHECK (
    (status = 'draft' AND credit_note_number IS NULL AND issued_at IS NULL)
    OR (
      status = 'issued' AND credit_note_number IS NOT NULL
      AND length(trim(credit_note_number)) > 0 AND issued_at IS NOT NULL
    )
  ),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
    ON DELETE CASCADE,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, id, invoice_id),
  UNIQUE (organization_id, credit_note_number)
);

CREATE INDEX idx_credit_notes_invoice_history
  ON credit_notes(organization_id, invoice_id, created_at, id);
CREATE INDEX idx_credit_notes_invoice_issued
  ON credit_notes(organization_id, invoice_id) WHERE status = 'issued';

CREATE TABLE credit_note_lines (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  credit_note_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_line_id TEXT NOT NULL,
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
  amount_minor INTEGER NOT NULL CHECK (
    amount_minor BETWEEN 0 AND 9007199254740991
  ),
  discount_mode TEXT CHECK (discount_mode IN ('percent', 'fixed')),
  discount_value TEXT CHECK (
    discount_value IS NULL OR (
      length(discount_value) > 0
      AND discount_value GLOB '[0-9]*'
      AND discount_value NOT GLOB '*[^0-9.]*'
      AND discount_value NOT LIKE '%.%.%'
    )
  ),
  line_discount_minor INTEGER NOT NULL CHECK (
    line_discount_minor BETWEEN 0 AND 9007199254740991
  ),
  allocated_invoice_discount_minor INTEGER NOT NULL CHECK (
    allocated_invoice_discount_minor BETWEEN 0 AND 9007199254740991
  ),
  net_minor INTEGER NOT NULL CHECK (net_minor BETWEEN 0 AND 9007199254740991),
  tax_treatment TEXT CHECK (
    tax_treatment IN ('taxable', 'nil_rated', 'exempt', 'non_gst')
  ),
  gst_rate TEXT CHECK (
    gst_rate IS NULL OR (
      length(gst_rate) > 0 AND gst_rate GLOB '*[0-9]*'
      AND gst_rate NOT GLOB '*[^0-9.]*' AND gst_rate NOT LIKE '%.%.%'
      AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  cgst_rate TEXT CHECK (
    cgst_rate IS NULL OR (
      length(cgst_rate) > 0 AND cgst_rate GLOB '*[0-9]*'
      AND cgst_rate NOT GLOB '*[^0-9.]*' AND cgst_rate NOT LIKE '%.%.%'
      AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  sgst_rate TEXT CHECK (
    sgst_rate IS NULL OR (
      length(sgst_rate) > 0 AND sgst_rate GLOB '*[0-9]*'
      AND sgst_rate NOT GLOB '*[^0-9.]*' AND sgst_rate NOT LIKE '%.%.%'
      AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  igst_rate TEXT CHECK (
    igst_rate IS NULL OR (
      length(igst_rate) > 0 AND igst_rate GLOB '*[0-9]*'
      AND igst_rate NOT GLOB '*[^0-9.]*' AND igst_rate NOT LIKE '%.%.%'
      AND CAST(igst_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  cgst_amount_minor INTEGER NOT NULL CHECK (
    cgst_amount_minor BETWEEN 0 AND 9007199254740991
  ),
  sgst_amount_minor INTEGER NOT NULL CHECK (
    sgst_amount_minor BETWEEN 0 AND 9007199254740991
  ),
  igst_amount_minor INTEGER NOT NULL CHECK (
    igst_amount_minor BETWEEN 0 AND 9007199254740991
  ),
  foreign_tax_label TEXT CHECK (
    foreign_tax_label IS NULL OR length(trim(foreign_tax_label)) BETWEEN 1 AND 80
  ),
  foreign_tax_mode TEXT CHECK (foreign_tax_mode IN ('percent', 'fixed')),
  foreign_tax_rate TEXT CHECK (
    foreign_tax_rate IS NULL OR (
      length(foreign_tax_rate) > 0 AND foreign_tax_rate GLOB '*[0-9]*'
      AND foreign_tax_rate NOT GLOB '*[^0-9.]*' AND foreign_tax_rate NOT LIKE '%.%.%'
      AND CAST(foreign_tax_rate AS REAL) BETWEEN 0 AND 100
    )
  ),
  foreign_tax_amount_minor INTEGER NOT NULL CHECK (
    foreign_tax_amount_minor BETWEEN 0 AND 9007199254740991
  ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (line_discount_minor + allocated_invoice_discount_minor <= amount_minor),
  CHECK (
    discount_mode IS NOT NULL OR (discount_value IS NULL AND line_discount_minor = 0)
  ),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, credit_note_id, invoice_id)
    REFERENCES credit_notes(organization_id, id, invoice_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, invoice_line_id, invoice_id)
    REFERENCES invoice_lines(organization_id, id, invoice_id),
  UNIQUE (credit_note_id, invoice_line_id),
  UNIQUE (credit_note_id, position)
);

CREATE INDEX idx_credit_note_lines_invoice
  ON credit_note_lines(organization_id, invoice_id, credit_note_id);

CREATE TABLE credit_note_pdf_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  credit_note_id TEXT NOT NULL,
  data BLOB NOT NULL CHECK (length(data) > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, credit_note_id, invoice_id)
    REFERENCES credit_notes(organization_id, id, invoice_id) ON DELETE CASCADE,
  UNIQUE (organization_id, credit_note_id)
);
