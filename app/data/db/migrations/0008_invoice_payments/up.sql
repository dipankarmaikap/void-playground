-- #49 records confirmed offline invoice payments without changing the immutable issued
-- invoice, using the same-Organization composite parent key established in 0002.

CREATE TABLE invoice_payments (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_date TEXT NOT NULL CHECK (
    payment_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  amount_minor INTEGER NOT NULL CHECK (
    amount_minor > 0 AND amount_minor <= 9007199254740991
  ),
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'upi', 'card', 'cheque_demand_draft', 'bank_transfer',
    'international_wire', 'other'
  )),
  reference TEXT CHECK (reference IS NULL OR length(reference) <= 200),
  voided_at INTEGER,
  void_reason TEXT CHECK (
    void_reason IS NULL OR length(void_reason) <= 1000
  ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (voided_at IS NULL AND void_reason IS NULL)
    OR (
      voided_at IS NOT NULL AND void_reason IS NOT NULL
      AND length(trim(void_reason, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
    )
  ),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
    ON DELETE CASCADE
);
CREATE INDEX idx_invoice_payments_invoice_history
  ON invoice_payments(organization_id, invoice_id, payment_date, created_at);
CREATE INDEX idx_invoice_payments_invoice_active
  ON invoice_payments(organization_id, invoice_id) WHERE voided_at IS NULL;
