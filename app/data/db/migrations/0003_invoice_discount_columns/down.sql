-- Reverts 0003 by dropping the added columns; their per-column CHECKs go with them.

ALTER TABLE invoice_lines DROP COLUMN net_minor;
ALTER TABLE invoice_lines DROP COLUMN allocated_invoice_discount_minor;
ALTER TABLE invoice_lines DROP COLUMN line_discount_minor;
ALTER TABLE invoice_lines DROP COLUMN discount_value;
ALTER TABLE invoice_lines DROP COLUMN discount_mode;
ALTER TABLE invoices DROP COLUMN round_off_minor;
ALTER TABLE invoices DROP COLUMN net_subtotal_minor;
ALTER TABLE invoices DROP COLUMN invoice_discount_minor;
ALTER TABLE invoices DROP COLUMN invoice_discount_value;
ALTER TABLE invoices DROP COLUMN invoice_discount_mode;
ALTER TABLE invoices DROP COLUMN line_discount_total_minor;
