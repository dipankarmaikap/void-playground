import { eq } from 'remix/data-table';

import { db, invoiceLines, invoices } from './db.ts';
import type { Invoice, InvoiceLine } from './db.ts';
import type { InvoiceDraftChanges } from './invoice-draft.ts';

export type InvoiceDirectoryItem = Pick<
  Invoice,
  'id' | 'recipient_legal_name' | 'status' | 'currency' | 'invoice_date' | 'total_minor' | 'created_at'
>;

/**
 * Returns the current Organization's invoices, newest first. Directory search, filters, and
 * pagination belong to a later ticket; this slice only needs a stable, scoped listing.
 */
export async function listInvoices(organizationId: string): Promise<InvoiceDirectoryItem[]> {
  return db
    .query(invoices)
    .where(eq(invoices.organization_id, organizationId))
    .select({
      id: invoices.id,
      recipient_legal_name: invoices.recipient_legal_name,
      status: invoices.status,
      currency: invoices.currency,
      invoice_date: invoices.invoice_date,
      total_minor: invoices.total_minor,
      created_at: invoices.created_at,
    })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc')
    .all();
}

/** Finds one invoice only within the Organization resolved from the authenticated membership. */
export function findInvoice(organizationId: string, id: string): Promise<Invoice | null> {
  return db.findOne(invoices, { where: { id, organization_id: organizationId } });
}

/** Reads an invoice's service lines in their saved order, scoped to the same Organization. */
export function findInvoiceLines(organizationId: string, invoiceId: string): Promise<InvoiceLine[]> {
  return db.findMany(invoiceLines, {
    where: { organization_id: organizationId, invoice_id: invoiceId },
    orderBy: [['position', 'asc']],
  });
}

function invoiceValues(changes: InvoiceDraftChanges) {
  let { lines: _lines, ...invoiceColumns } = changes;
  return invoiceColumns;
}

/** Inserts a Draft and its service lines atomically. Organization id always comes from the server. */
export async function createDraftInvoice(
  organizationId: string,
  clientId: string,
  changes: InvoiceDraftChanges,
): Promise<Invoice | null> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.transaction(async (tx) => {
    await tx.create(invoices, {
      id,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'draft',
      invoice_number: null,
      ...invoiceValues(changes),
      created_at: now,
      updated_at: now,
    });
    for (let line of changes.lines) {
      await tx.create(invoiceLines, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        invoice_id: id,
        position: line.position,
        description: line.description,
        sac: line.sac,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount_minor: line.amount_minor,
        created_at: now,
        updated_at: now,
      });
    }
  });
  return findInvoice(organizationId, id);
}

/** Replaces a Draft's editable fields and service lines atomically, scoped to its Organization. */
export async function updateDraftInvoice(
  organizationId: string,
  id: string,
  changes: InvoiceDraftChanges,
): Promise<Invoice | null> {
  let now = Date.now();
  await db.transaction(async (tx) => {
    await tx.updateMany(
      invoices,
      { ...invoiceValues(changes), updated_at: now },
      { where: { id, organization_id: organizationId, status: 'draft' }, limit: 1 },
    );
    await tx.deleteMany(invoiceLines, {
      where: { organization_id: organizationId, invoice_id: id },
    });
    for (let line of changes.lines) {
      await tx.create(invoiceLines, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        invoice_id: id,
        position: line.position,
        description: line.description,
        sac: line.sac,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount_minor: line.amount_minor,
        created_at: now,
        updated_at: now,
      });
    }
  });
  return findInvoice(organizationId, id);
}

/** Discards a Draft and its lines. Issued documents are never deletable through this path. */
export async function discardDraftInvoice(
  organizationId: string,
  id: string,
): Promise<boolean> {
  let result = await db.deleteMany(invoices, {
    where: { id, organization_id: organizationId, status: 'draft' },
    limit: 1,
  });
  return result.affectedRows > 0;
}
