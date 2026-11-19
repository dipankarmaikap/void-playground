-- Tightens the invoice-line rate CHECK constraints without discarding saved data. A lone
-- decimal point was previously accepted and SQLite interpreted it as numeric zero, so only
-- that malformed representation is canonicalized before the copy. The rebuilt table is the
-- modern invoice_lines declaration; the explicit INSERT/SELECT lists map each column by name,
-- so the historical ALTER-appended storage order does not matter.

CREATE TABLE invoice_lines_with_valid_tax_rates (
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
    gst_rate IS NULL OR (length(gst_rate) > 0 AND gst_rate GLOB '*[0-9]*'
      AND gst_rate NOT GLOB '*[^0-9.]*'
      AND gst_rate NOT LIKE '%.%.%' AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100)
  ),
  cgst_rate TEXT CHECK (cgst_rate IS NULL OR (
    length(cgst_rate) > 0 AND cgst_rate GLOB '*[0-9]*'
    AND cgst_rate NOT GLOB '*[^0-9.]*'
    AND cgst_rate NOT LIKE '%.%.%' AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100
  )),
  sgst_rate TEXT CHECK (sgst_rate IS NULL OR (
    length(sgst_rate) > 0 AND sgst_rate GLOB '*[0-9]*'
    AND sgst_rate NOT GLOB '*[^0-9.]*'
    AND sgst_rate NOT LIKE '%.%.%' AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100
  )),
  igst_rate TEXT CHECK (igst_rate IS NULL OR (
    length(igst_rate) > 0 AND igst_rate GLOB '*[0-9]*'
    AND igst_rate NOT GLOB '*[^0-9.]*'
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
      length(foreign_tax_rate) > 0 AND foreign_tax_rate GLOB '*[0-9]*'
      AND foreign_tax_rate NOT GLOB '*[^0-9.]*'
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

UPDATE invoice_lines
SET gst_rate = CASE WHEN gst_rate = '.' THEN '0' ELSE gst_rate END,
    cgst_rate = CASE WHEN cgst_rate = '.' THEN '0' ELSE cgst_rate END,
    sgst_rate = CASE WHEN sgst_rate = '.' THEN '0' ELSE sgst_rate END,
    igst_rate = CASE WHEN igst_rate = '.' THEN '0' ELSE igst_rate END,
    foreign_tax_rate = CASE
      WHEN foreign_tax_rate = '.' THEN '0'
      ELSE foreign_tax_rate
    END;

INSERT INTO invoice_lines_with_valid_tax_rates (
  id, organization_id, invoice_id, position, description, sac, quantity, unit_price,
  amount_minor, discount_mode, discount_value, line_discount_minor,
  allocated_invoice_discount_minor, net_minor, tax_treatment, gst_rate, cgst_rate, sgst_rate,
  igst_rate, cgst_amount_minor, sgst_amount_minor, igst_amount_minor, foreign_tax_label,
  foreign_tax_mode, foreign_tax_rate, foreign_tax_amount_minor, created_at, updated_at
)
SELECT
  id, organization_id, invoice_id, position, description, sac, quantity, unit_price,
  amount_minor, discount_mode, discount_value, line_discount_minor,
  allocated_invoice_discount_minor, net_minor, tax_treatment, gst_rate, cgst_rate, sgst_rate,
  igst_rate, cgst_amount_minor, sgst_amount_minor, igst_amount_minor, foreign_tax_label,
  foreign_tax_mode, foreign_tax_rate, foreign_tax_amount_minor, created_at, updated_at
FROM invoice_lines;
DROP TABLE invoice_lines;
ALTER TABLE invoice_lines_with_valid_tax_rates RENAME TO invoice_lines;
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);
