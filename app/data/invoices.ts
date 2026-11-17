import { gte, ilike, lte, or } from 'remix/data-table';

import { db, invoiceLines, invoices } from './db.ts';
import type { Invoice, InvoiceLine } from './db.ts';
import { invoiceDisplayStatus } from './invoice-issuance.ts';
import type { InvoiceDisplayStatus } from './invoice-issuance.ts';
import { activeInvoicePaymentTotals } from './invoice-payments.ts';
import { activeInvoiceRefundTotals, invoiceFinancialBalances } from './invoice-refunds.ts';
import { activeInvoiceCreditNoteTotals, invoiceCreditNoteLabels } from './credit-notes.ts';
import type { InvoiceDraftChanges, InvoiceLineChanges } from './invoice-draft.ts';
import { isValidIsoDate, todayInKolkata } from './invoice-dates.ts';

/** User-facing label for the only status a Draft can have in this ticket. */
export const DRAFT_STATUS_LABEL = 'Draft';

export const INVOICE_DIRECTORY_PAGE_SIZE = 20;
const INVOICE_DIRECTORY_SCAN_BATCH_SIZE = 100;

export type InvoiceDirectoryItem = Pick<
  Invoice,
  | 'id'
  | 'recipient_legal_name'
  | 'invoice_number'
  | 'currency'
  | 'invoice_date'
  | 'total_minor'
  | 'created_at'
> & {
  status: InvoiceDisplayStatus;
  amount_paid_minor: number;
  credited_total_minor: number;
  revised_total_minor: number;
  balance_due_minor: number;
  refund_due_minor: number;
  credit_note_numbers: string[];
};

type InvoiceDirectoryRow = Pick<
  Invoice,
  | 'id'
  | 'recipient_legal_name'
  | 'invoice_number'
  | 'status'
  | 'currency'
  | 'invoice_date'
  | 'due_date'
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
  /** Derived display status (`draft`, `sent`, `partially_paid`, `paid`, `overdue`, `cancelled`), or `all`. */
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
 * Status value that can never match a stored invoice status. Raw lifecycle slugs such as `issued`
 * must not bypass the derived display statuses, so unrecognized filters query against this instead.
 */
export const NO_DISPLAY_STATUS = '__no_display_status__';

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
  let today = todayInKolkata();
  let isDerivedStatusFilter = ['sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].includes(
    status,
  );
  let filteredQuery = db
    .query(invoices)
    .where({ organization_id: organizationId, document_type: 'invoice' });
  if (filter.clientId) filteredQuery = filteredQuery.where({ client_id: filter.clientId });
  if (status === 'draft') {
    filteredQuery = filteredQuery.where({ status: 'draft' });
  } else if (isDerivedStatusFilter) {
    // Payment states are derived from the current payment history, not stored invoice columns.
    filteredQuery = filteredQuery.where({ status: 'issued' });
  } else if (status !== 'all') {
    // Raw lifecycle values such as `issued` are not display statuses and must not bypass derivation.
    filteredQuery = filteredQuery.where({ status: NO_DISPLAY_STATUS });
  }
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
      due_date: invoices.due_date,
      total_minor: invoices.total_minor,
      created_at: invoices.created_at,
    })
    .orderBy('invoice_date', 'desc')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc');

  if (!literalSearch && !isDerivedStatusFilter) {
    let rows = await query
      .limit(INVOICE_DIRECTORY_PAGE_SIZE + 1)
      .offset(offset)
      .all();
    let [paymentTotals, creditTotals, refundTotals, creditNoteLabels] = await Promise.all([
      activeInvoicePaymentTotals(organizationId),
      activeInvoiceCreditNoteTotals(organizationId),
      activeInvoiceRefundTotals(organizationId),
      invoiceCreditNoteLabels(organizationId),
    ]);
    return {
      invoices: rows
        .slice(0, INVOICE_DIRECTORY_PAGE_SIZE)
        .map((row) =>
          invoiceDirectoryItem(row, today, paymentTotals, creditTotals, refundTotals, creditNoteLabels),
        ),
      page,
      hasPrevious: page > 1,
      hasNext: rows.length > INVOICE_DIRECTORY_PAGE_SIZE,
    };
  }

  let [paymentTotals, creditTotals, refundTotals, creditNoteLabels] = await Promise.all([
    activeInvoicePaymentTotals(organizationId),
    activeInvoiceCreditNoteTotals(organizationId),
    activeInvoiceRefundTotals(organizationId),
    invoiceCreditNoteLabels(organizationId),
  ]);
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
      if (literalSearch && !matchesInvoiceQuery(invoice, q)) continue;
      let item = invoiceDirectoryItem(
        invoice,
        today,
        paymentTotals,
        creditTotals,
        refundTotals,
        creditNoteLabels,
      );
      if (isDerivedStatusFilter && item.status !== status) continue;
      if (matchingCount >= offset) {
        matches.push(item);
      }
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

function invoiceDirectoryItem(
  row: InvoiceDirectoryRow,
  today: string,
  paymentTotals: ReadonlyMap<string, number>,
  creditTotals: ReadonlyMap<string, number>,
  refundTotals: ReadonlyMap<string, number>,
  creditNoteLabels: ReadonlyMap<string, string[]>,
): InvoiceDirectoryItem {
  let { due_date: _dueDate, status: _storedStatus, ...item } = row;
  let amountPaidMinor = paymentTotals.get(row.id) ?? 0;
  let creditedTotalMinor = creditTotals.get(row.id) ?? 0;
  let activeRefundedMinor = refundTotals.get(row.id) ?? 0;
  let balances = invoiceFinancialBalances(
    row.total_minor,
    creditedTotalMinor,
    amountPaidMinor,
    activeRefundedMinor,
  );
  return {
    ...item,
    status: invoiceDisplayStatus(row, balances.netPaidMinor, today, creditedTotalMinor),
    amount_paid_minor: amountPaidMinor,
    credited_total_minor: creditedTotalMinor,
    revised_total_minor: balances.revisedTotalMinor,
    balance_due_minor: balances.balanceDueMinor,
    refund_due_minor: balances.refundDueMinor,
    credit_note_numbers: creditNoteLabels.get(row.id) ?? [],
  };
}

function matchesInvoiceQuery(invoice: InvoiceDirectoryRow, q: string): boolean {
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

function invoiceLineValues(
  organizationId: string,
  invoiceId: string,
  line: InvoiceLineChanges,
  now: number,
) {
  return {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    invoice_id: invoiceId,
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
    tax_treatment: line.tax_treatment,
    gst_rate: line.gst_rate,
    cgst_rate: line.cgst_rate,
    sgst_rate: line.sgst_rate,
    igst_rate: line.igst_rate,
    cgst_amount_minor: line.cgst_amount_minor,
    sgst_amount_minor: line.sgst_amount_minor,
    igst_amount_minor: line.igst_amount_minor,
    foreign_tax_label: line.foreign_tax_label,
    foreign_tax_mode: line.foreign_tax_mode,
    foreign_tax_rate: line.foreign_tax_rate,
    foreign_tax_amount_minor: line.foreign_tax_amount_minor,
    created_at: now,
    updated_at: now,
  };
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
      await tx.create(invoiceLines, invoiceLineValues(organizationId, id, line, now));
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
  let updated = false;
  await db.transaction(async (tx) => {
    let result = await tx.updateMany(
      invoices,
      { ...invoiceValues(changes), updated_at: now },
      { where: { id, organization_id: organizationId, status: 'draft' }, limit: 1 },
    );
    if (result.affectedRows === 0) return;
    updated = true;
    await tx.deleteMany(invoiceLines, {
      where: { organization_id: organizationId, invoice_id: id },
    });
    for (let line of changes.lines) {
      await tx.create(invoiceLines, invoiceLineValues(organizationId, id, line, now));
    }
  });
  if (!updated) return null;
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

/** Changes only the private note on an issued invoice; all Client-facing fields stay locked. */
export async function updateIssuedInvoiceInternalNote(
  organizationId: string,
  id: string,
  internalNote: string | null,
): Promise<boolean> {
  let result = await db.updateMany(
    invoices,
    { internal_note: internalNote, updated_at: Date.now() },
    { where: { id, organization_id: organizationId, status: 'issued' }, limit: 1 },
  );
  return result.affectedRows > 0;
}
