-- The Organization-scoped Client directory listing filters by status, so the composite index
-- keeps that query fast as Clients grow.

CREATE INDEX idx_clients_organization_status ON clients(organization_id, status);
