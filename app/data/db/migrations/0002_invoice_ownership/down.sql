-- Reverts 0002 by dropping the invoice-era tables and the composite-FK parent index.

DROP TABLE invoice_pdf_artifacts;
DROP TABLE invoice_lines;
DROP TABLE invoices;
DROP INDEX idx_clients_organization_id;
