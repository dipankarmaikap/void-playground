-- The Client profile page loads one Organization's real invoice documents by client, and the
-- (organization_id, client_id) foreign key probes the same shape when a Client row goes away.
-- The composite index serves both without scanning the Organization's whole invoice book.

CREATE INDEX idx_invoices_organization_client_document
  ON invoices(organization_id, client_id, document_type);
