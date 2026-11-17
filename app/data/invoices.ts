import { gte, ilike, lte, or } from 'remix/data-table';

import { db, invoiceLines, invoices } from './db.ts';
import type { Invoice, InvoiceLine } from './db.ts';
import type { InvoiceDraftChanges } from './invoice-draft.ts';
import { isValidIsoDate } from './invoice-dates.ts';

/** User-facing label for the only status a Draft can have in this ticket. */
export const DRAFT_STATUS_LABEL = 'Draft';

export const INVOICE_DIRECTORY_PAGE_SIZE = 20;
const INVOICE_DIRECTORY_SCAN_BATCH_SIZE = 100;

export type InvoiceDirectoryItem = Pick<
  Invoice,
  | 'id'
  | 'recipient_legal_name'
  | 'invoice_number'
  | 'status'
  | 'currency'
  | 'invoice_date'
  | 'total_minor'
  | 'created_at'
>;

export interface InvoiceDirectoryPage {
  invoices: InvoiceDirectoryItem[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface InvoiceListFilter {
  /** Case-insensitive substring matched against recipient legal name and invoice number. */
  q?: string;
  /** Optional Client scope used by the Client profile's invoice link. */
  clientId?: string;
  /** Exact status, or `all` to include every current and future status. */
  status?: string;
  /** Inclusive invoice-date lower bound. Invalid dates are ignored. */
  from?: string;
  /** Inclusive invoice-date upper bound. Invalid dates are ignored. */
  to?: string;
  /** One-based page number; invalid values fall back to page 1. */
  page?: number;
}

const LIKE_WILDCARDS = /[%_]/;

/**
 * Returns one stable, bounded page from the current Organization's invoice book.
 *
 * SQLite LIKE treats `%` and `_` as wildcards and the data-table driver does not add an ESCAPE
 * clause. Those searches are instead matched literally in bounded batches after Organization
 * scope has been applied. Invoice-number matching is included for future issued documents; Drafts
 * currently have no assigned number.
 */
export async function listInvoices(
  organizationId: string,
  filter: InvoiceListFilter = {},
): Promise<InvoiceDirectoryPage> {
  let q = filter.q?.trim() ?? '';
  let status = filter.status ?? 'all';
  let page = normalizePage(filter.page);
  let offset = (page - 1) * INVOICE_DIRECTORY_PAGE_SIZE;
  let literalSearch = q !== '' && LIKE_WILDCARDS.test(q);
  let filteredQuery = db
    .query(invoices)
    .where({ organization_id: organizationId, document_type: 'invoice' });
  if (filter.clientId) filteredQuery = filteredQuery.where({ client_id: filter.clientId });
  if (status !== 'all') filteredQuery = filteredQuery.where({ status });
  if (filter.from && isValidIsoDate(filter.from)) {
    filteredQuery = filteredQuery.where(gte(invoices.invoice_date, filter.from));
  }
  if (filter.to && isValidIsoDate(filter.to)) {
    filteredQuery = filteredQuery.where(lte(invoices.invoice_date, filter.to));
  }
  if (q && !literalSearch) {
    let pattern = `%${q}%`;
    filteredQuery = filteredQuery.where(
      or(
        ilike(invoices.recipient_legal_name, pattern),
        ilike(invoices.invoice_number, pattern),
      ),
    );
  }

  let query = filteredQuery
    .select({
      id: invoices.id,
      recipient_legal_name: invoices.recipient_legal_name,
      invoice_number: invoices.invoice_number,
      status: invoices.status,
      currency: invoices.currency,
      invoice_date: invoices.invoice_date,
      total_minor: invoices.total_minor,
      created_at: invoices.created_at,
    })
    .orderBy('invoice_date', 'desc')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc');

  if (!literalSearch) {
    let rows = await query
      .limit(INVOICE_DIRECTORY_PAGE_SIZE + 1)
      .offset(offset)
      .all();
    return {
      invoices: rows.slice(0, INVOICE_DIRECTORY_PAGE_SIZE),
      page,
      hasPrevious: page > 1,
      hasNext: rows.length > INVOICE_DIRECTORY_PAGE_SIZE,
    };
  }

  let matches: InvoiceDirectoryItem[] = [];
  let scanned = 0;
  let matchingCount = 0;
  while (matches.length < INVOICE_DIRECTORY_PAGE_SIZE + 1) {
    let batch = await query
      .limit(INVOICE_DIRECTORY_SCAN_BATCH_SIZE)
      .offset(scanned)
      .all();
    if (batch.length === 0) break;

    for (let invoice of batch) {
      if (!matchesInvoiceQuery(invoice, q)) continue;
      if (matchingCount >= offset) matches.push(invoice);
      matchingCount += 1;
      if (matches.length >= INVOICE_DIRECTORY_PAGE_SIZE + 1) break;
    }

    scanned += batch.length;
    if (batch.length < INVOICE_DIRECTORY_SCAN_BATCH_SIZE) break;
  }

  return {
    invoices: matches.slice(0, INVOICE_DIRECTORY_PAGE_SIZE),
    page,
    hasPrevious: page > 1,
    hasNext: matches.length > INVOICE_DIRECTORY_PAGE_SIZE,
  };
}

export function parseInvoiceDirectoryPage(value: string | null): number {
  if (value == null || !/^\d+$/.test(value)) return 1;
  return normalizePage(Number(value));
}

/** Accepts any safe status slug so later invoice states can be filtered without changing this API. */
export function parseInvoiceStatusFilter(value: string | null): string {
  if (value == null || value === '' || value === 'all') return 'all';
  return /^[a-z][a-z0-9_-]*$/.test(value) ? value : 'all';
}

/** Keeps only valid ISO calendar dates from untrusted directory query parameters. */
export function parseInvoiceDirectoryDateFilter(value: string | null): string {
  return value && isValidIsoDate(value) ? value : '';
}

function normalizePage(page: number | undefined): number {
  if (
    page == null ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / INVOICE_DIRECTORY_PAGE_SIZE)
  ) {
    return 1;
  }
  return page;
}

function matchesInvoiceQuery(invoice: InvoiceDirectoryItem, q: string): boolean {
  let needle = q.toLowerCase();
  return (
    invoice.recipient_legal_name.toLowerCase().includes(needle) ||
    invoice.invoice_number?.toLowerCase().includes(needle) === true
  );
}

/** Finds one invoice only within the Organization resolved from the authenticated membership. */
export function findInvoice(organizationId: string, id: string): Promise<Invoice | null> {
  return db.findOne(invoices, { where: { id, organization_id: organizationId } });
}

/** Counts one Client's invoices without crossing either its Organization or Client boundary. */
export function countClientInvoices(organizationId: string, clientId: string): Promise<number> {
  return db.count(invoices, {
    where: { organization_id: organizationId, client_id: clientId, document_type: 'invoice' },
  });
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
        discount_mode: line.discount_mode,
        discount_value: line.discount_value,
        line_discount_minor: line.line_discount_minor,
        allocated_invoice_discount_minor: line.allocated_invoice_discount_minor,
        net_minor: line.net_minor,
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
        discount_mode: line.discount_mode,
        discount_value: line.discount_value,
        line_discount_minor: line.line_discount_minor,
        allocated_invoice_discount_minor: line.allocated_invoice_discount_minor,
        net_minor: line.net_minor,
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
