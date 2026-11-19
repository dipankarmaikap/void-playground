-- #43 adds the discount and round-off columns to a database created by 0002 and backfills net
-- amounts for rows that predate them. The journal owns run-once, so the backfills run exactly
-- once at upgrade time and never rewrite legitimate discounted rows on later startups.

ALTER TABLE invoices ADD COLUMN line_discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0);
ALTER TABLE invoices ADD COLUMN invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed'));
ALTER TABLE invoices ADD COLUMN invoice_discount_value TEXT CHECK (
  invoice_discount_value IS NULL OR (
    length(invoice_discount_value) > 0
    AND invoice_discount_value GLOB '[0-9]*'
    AND invoice_discount_value NOT GLOB '*[^0-9.]*'
    AND invoice_discount_value NOT LIKE '%.%.%'
  )
);
ALTER TABLE invoices ADD COLUMN invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0);
ALTER TABLE invoices ADD COLUMN net_subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0);
ALTER TABLE invoices ADD COLUMN round_off_minor INTEGER NOT NULL DEFAULT 0;
UPDATE invoices SET net_subtotal_minor = subtotal_minor;

ALTER TABLE invoice_lines ADD COLUMN discount_mode TEXT CHECK (discount_mode IN ('percent', 'fixed'));
ALTER TABLE invoice_lines ADD COLUMN discount_value TEXT CHECK (
  discount_value IS NULL OR (
    length(discount_value) > 0
    AND discount_value GLOB '[0-9]*'
    AND discount_value NOT GLOB '*[^0-9.]*'
    AND discount_value NOT LIKE '%.%.%'
  )
);
ALTER TABLE invoice_lines ADD COLUMN line_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_minor >= 0);
ALTER TABLE invoice_lines ADD COLUMN allocated_invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (allocated_invoice_discount_minor >= 0);
ALTER TABLE invoice_lines ADD COLUMN net_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_minor >= 0);
UPDATE invoice_lines SET net_minor = amount_minor;
