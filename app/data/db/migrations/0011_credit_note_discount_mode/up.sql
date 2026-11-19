-- #53 carries the original invoice's frozen discount mode onto Credit Notes so their PDFs
-- label the credited invoice discount correctly. Existing notes are backfilled from their
-- parent invoice; the journal guarantees the backfill runs exactly once.

ALTER TABLE credit_notes ADD COLUMN invoice_discount_mode
  TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed'));
UPDATE credit_notes
SET invoice_discount_mode = (
  SELECT parent.invoice_discount_mode FROM invoices AS parent
  WHERE parent.organization_id = credit_notes.organization_id
    AND parent.id = credit_notes.invoice_id
);
