-- Reverts 0010 by dropping the Credit Note tables and the invoice-lines index that exists only
-- to make their composite parent key referenceable.

DROP TABLE credit_note_pdf_artifacts;
DROP TABLE credit_note_lines;
DROP TABLE credit_notes;
DROP INDEX idx_invoice_lines_org_line_invoice;
