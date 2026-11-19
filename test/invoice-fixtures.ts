import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { invoices } from '../app/data/db.ts';
import { routes } from '../app/routes.ts';
import { submitForm, type TestApp } from './http.ts';

export interface InvoiceFixture {
  id: string;
  recipientName: string;
  invoiceDate?: string;
  createdAt?: number;
}

/**
 * Seeds a Draft invoice for route tests; reads should still go through the public GET routes.
 * Pass the database the router under test was built around (from `createTestRouter()`).
 */
export async function seedInvoice(
  db: SqliteDatabase,
  organizationId: string,
  clientId: string,
  fixture: InvoiceFixture,
): Promise<void> {
  let invoiceDate = fixture.invoiceDate ?? '2026-10-01';
  let createdAt = fixture.createdAt ?? Date.now();

  await db.create(invoices, {
    id: fixture.id,
    organization_id: organizationId,
    client_id: clientId,
    document_type: 'invoice',
    status: 'draft',
    invoice_number: null,
    currency: 'INR',
    invoice_date: invoiceDate,
    due_date: invoiceDate,
    payment_term: 'due_on_receipt',
    custom_payment_terms: null,
    recipient_legal_name: fixture.recipientName,
    recipient_billing_line1: null,
    recipient_billing_locality: null,
    recipient_billing_region: null,
    recipient_billing_postal_code: null,
    recipient_billing_country: null,
    recipient_tax_country: null,
    recipient_tax_type: null,
    recipient_tax_value: null,
    recipient_tax_state_name: null,
    recipient_tax_state_code: null,
    payment_instructions: null,
    customer_notes: null,
    internal_note: null,
    subtotal_minor: 1000,
    line_discount_total_minor: 0,
    invoice_discount_mode: null,
    invoice_discount_value: null,
    invoice_discount_minor: 0,
    net_subtotal_minor: 1000,
    round_off_minor: 0,
    total_minor: 1000,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

/** Marks a Draft as sent by submitting the show page's issue action through the given router. */
export async function markAsSent(
  app: TestApp,
  cookie: string,
  invoiceId: string,
): Promise<Response> {
  return submitForm(
    app,
    routes.app.invoices.show.href({ invoiceId }),
    routes.app.invoices.lifecycle.issue.href({ invoiceId }),
    {},
    cookie,
  );
}
