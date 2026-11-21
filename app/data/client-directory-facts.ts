import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { clients, invoicePayments, invoices } from './db.ts';
import type { Invoice, InvoicePayment } from './db.ts';
import type { ClientStatus } from './client-status.ts';
import { daysBetween, todayInKolkata } from './invoices/dates.ts';
import type { InvoiceDisplayStatus } from './invoices/issuance.ts';
import { invoiceDisplayStatus } from './invoices/issuance.ts';
import { activeInvoiceCreditNoteTotals } from './invoices/credit-notes.ts';
import { activePaymentTotalsFromRows } from './invoices/payments.ts';
import { activeInvoiceRefundTotals, invoiceFinancialBalances } from './invoices/refunds.ts';

export interface ClientDirectorySummary {
  /** Active Clients belonging to this Organization. */
  activeClientCount: number;
  /** Net balance due across this Organization's real invoice documents, in minor units. */
  outstandingBalanceMinor: number;
  /** Active Clients created during the current Kolkata calendar month. */
  newClientsThisMonth: number;
  /** Currency of the Organization's most recent invoice, used to format displayed balances. */
  currency: string;
  /** Mean days from Invoice issue to active payment; null when no honest history exists. */
  averageCollectionDays: number | null;
}

export interface ClientFacts {
  /** The Client's lifecycle status in this Organization. */
  lifecycleStatus: ClientStatus;
  invoiceCount: number;
  outstandingBalanceMinor: number;
  lastInvoiceDate: string | null;
  /** Derived display status of this Client's most recent invoice, or null when it has none. */
  status: InvoiceDisplayStatus | null;
  /** True when at least one of this Client's invoices is currently overdue. */
  hasOverdueInvoice: boolean;
}

export interface ClientDirectoryFacts {
  summary: ClientDirectorySummary;
  /** Facts keyed by Client id; empty for Organizations with no Clients. */
  clients: Map<string, ClientFacts>;
}

/** A follow-up view derived from real Invoice display statuses. */
export type ClientFollowUpView = 'current' | 'overdue';

/**
 * The directory's follow-up filter: one of the derived views, or the unfiltered
 * whole. Owned here so the controller and the page share one union with the
 * facts that define it.
 */
export type ClientFollowUpFilter = 'all' | ClientFollowUpView;

/**
 * The Organization-scoped Invoice rows and payment totals shared by both fact derivations.
 * `clientId` narrows the Invoice rows only; totals stay Organization-scoped so the same
 * domain helpers can be reused unchanged.
 */
interface OrganizationInvoiceData {
  invoices: Invoice[];
  invoiceById: Map<string, Invoice>;
  paymentTotals: Map<string, number>;
  creditTotals: Map<string, number>;
  refundTotals: Map<string, number>;
  payments: InvoicePayment[];
}

async function loadOrganizationInvoiceData(
  db: SqliteDatabase,
  organizationId: string,
  clientId?: string,
): Promise<OrganizationInvoiceData> {
  let invoiceWhere = clientId
    ? { organization_id: organizationId, client_id: clientId, document_type: 'invoice' }
    : { organization_id: organizationId, document_type: 'invoice' };
  // The payment rows are loaded once: `collectionAverage` reads them directly and the
  // totals map is derived in memory, so `invoice_payments` is scanned a single time.
  let [rows, payments, creditTotals, refundTotals] = await Promise.all([
    db.findMany(invoices, { where: invoiceWhere }),
    db.findMany(invoicePayments, {
      where: { organization_id: organizationId, voided_at: null },
    }),
    activeInvoiceCreditNoteTotals(db, organizationId),
    activeInvoiceRefundTotals(db, organizationId),
  ]);

  return {
    invoices: rows,
    invoiceById: new Map(rows.map((invoice) => [invoice.id, invoice])),
    paymentTotals: activePaymentTotalsFromRows(payments),
    creditTotals,
    refundTotals,
    payments,
  };
}

/** Balances and derived display status for one real Invoice row. */
interface DerivedInvoice {
  invoice: Invoice;
  creditedTotalMinor: number;
  balances: ReturnType<typeof invoiceFinancialBalances>;
  status: InvoiceDisplayStatus;
}

function deriveInvoice(
  invoice: Invoice,
  data: OrganizationInvoiceData,
  today: string,
): DerivedInvoice {
  let creditedTotalMinor = data.creditTotals.get(invoice.id) ?? 0;
  let balances = invoiceFinancialBalances(
    invoice.total_minor,
    creditedTotalMinor,
    data.paymentTotals.get(invoice.id) ?? 0,
    data.refundTotals.get(invoice.id) ?? 0,
  );
  return {
    invoice,
    creditedTotalMinor,
    balances,
    status: invoiceDisplayStatus(invoice, balances.netPaidMinor, today, creditedTotalMinor),
  };
}

/** Newest Invoice first, with deterministic date/created-at/id tie-breakers. */
function sortInvoicesNewestFirst(rows: readonly Invoice[]): Invoice[] {
  return [...rows].sort(
    (a, b) =>
      b.invoice_date.localeCompare(a.invoice_date) ||
      b.created_at - a.created_at ||
      b.id.localeCompare(a.id),
  );
}

/** Currency of the newest Invoice; the caller passes rows already sorted newest-first. */
function currencyOf(sortedRows: readonly Invoice[]): string {
  return sortedRows[0]?.currency ?? 'INR';
}

/** Mean whole days from Invoice issue to active payment, or null without honest history. */
function collectionAverage(data: OrganizationInvoiceData): number | null {
  let totalCollectionDays = 0;
  let collectionSampleCount = 0;
  for (let payment of data.payments) {
    let invoice = data.invoiceById.get(payment.invoice_id);
    if (!invoice) continue;
    let days = daysBetween(invoice.invoice_date, payment.payment_date);
    if (days === null) continue;
    totalCollectionDays += days;
    collectionSampleCount += 1;
  }
  return collectionSampleCount === 0
    ? null
    : Math.round((totalCollectionDays / collectionSampleCount) * 10) / 10;
}

/**
 * Derives every Clients-directory metric for one Organization at read time.
 *
 * All financial and status rules are delegated to the invoice domain helpers; this module only
 * groups their results by Client. `today` is injectable so Kolkata-date-dependent statuses and
 * month boundaries can be tested deterministically.
 */
export async function getClientDirectoryFacts(
  db: SqliteDatabase,
  organizationId: string,
  today: string = todayInKolkata(),
): Promise<ClientDirectoryFacts> {
  let [organizationClients, data] = await Promise.all([
    db.findMany(clients, { where: { organization_id: organizationId } }),
    loadOrganizationInvoiceData(db, organizationId),
  ]);

  let clientFacts = new Map<string, ClientFacts>();
  let monthPrefix = today.slice(0, 7);
  let activeClientCount = 0;
  let newClientsThisMonth = 0;

  for (let client of organizationClients) {
    let active = client.status === 'active';
    if (active) {
      activeClientCount += 1;
      if (todayInKolkata(new Date(client.created_at)).slice(0, 7) === monthPrefix) {
        newClientsThisMonth += 1;
      }
    }
    clientFacts.set(client.id, {
      lifecycleStatus: client.status,
      invoiceCount: 0,
      outstandingBalanceMinor: 0,
      lastInvoiceDate: null,
      status: null,
      hasOverdueInvoice: false,
    });
  }

  let outstandingBalanceMinor = 0;
  let sortedInvoices = sortInvoicesNewestFirst(data.invoices);
  for (let invoice of sortedInvoices) {
    let derived = deriveInvoice(invoice, data, today);
    outstandingBalanceMinor += derived.balances.balanceDueMinor;

    let facts = clientFacts.get(derived.invoice.client_id);
    if (!facts) continue;
    facts.invoiceCount += 1;
    facts.outstandingBalanceMinor += derived.balances.balanceDueMinor;
    let { invoice_date: invoiceDate } = derived.invoice;
    if (facts.lastInvoiceDate === null || invoiceDate > facts.lastInvoiceDate) {
      facts.lastInvoiceDate = invoiceDate;
      facts.status = derived.status;
    } else if (
      invoiceDate === facts.lastInvoiceDate &&
      derived.status === 'overdue' &&
      facts.status !== 'overdue'
    ) {
      // Equal-dated invoices are not an arbitrary winner: an unpaid, past-due Invoice must
      // not be masked by a paid one just because the database returned it first.
      facts.status = 'overdue';
    }
    if (derived.status === 'overdue') facts.hasOverdueInvoice = true;
  }

  return {
    summary: {
      activeClientCount,
      outstandingBalanceMinor,
      newClientsThisMonth,
      currency: currencyOf(sortedInvoices),
      averageCollectionDays: collectionAverage(data),
    },
    clients: clientFacts,
  };
}

/**
 * Organization-wide Client ids matching a follow-up view, taken from the same facts that feed
 * the summary cards. The index controller passes these to `listClients` so the filter runs
 * before pagination instead of after it.
 */
export function clientIdsForFollowUp(
  facts: ClientDirectoryFacts,
  view: ClientFollowUpView,
): string[] {
  let ids: string[] = [];
  for (let [id, clientFacts] of facts.clients) {
    if (view === 'overdue' ? clientFacts.hasOverdueInvoice : !clientFacts.hasOverdueInvoice) {
      ids.push(id);
    }
  }
  return ids;
}

/** One real Invoice row prepared for a Client's invoice-history table. */
export interface ClientInvoiceRow {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalMinor: number;
  currency: string;
  status: InvoiceDisplayStatus;
}

/** Real Invoice-derived facts used by a single Client profile page. */
export interface ClientProfileFacts {
  currency: string;
  totalInvoicedMinor: number;
  outstandingBalanceMinor: number;
  paidInvoiceCount: number;
  invoiceCount: number;
  averageCollectionDays: number | null;
  /** Most recent Invoice first. */
  invoices: ClientInvoiceRow[];
}

/**
 * Derives one Client's Invoice history and summary from real, Organization-scoped rows.
 * Every balance and display status comes from the Invoice domain helpers; when there is no
 * honest payment history the collection average is null so the UI can show an empty indicator.
 */
export async function getClientProfileFacts(
  db: SqliteDatabase,
  organizationId: string,
  clientId: string,
  today: string = todayInKolkata(),
): Promise<ClientProfileFacts> {
  let data = await loadOrganizationInvoiceData(db, organizationId, clientId);
  let sortedInvoices = sortInvoicesNewestFirst(data.invoices);
  let derived = sortedInvoices.map((invoice) => deriveInvoice(invoice, data, today));

  let totalInvoicedMinor = 0;
  let outstandingBalanceMinor = 0;
  let paidInvoiceCount = 0;
  let rows: ClientInvoiceRow[] = [];

  for (let item of derived) {
    totalInvoicedMinor += item.invoice.total_minor;
    outstandingBalanceMinor += item.balances.balanceDueMinor;
    if (item.status === 'paid') paidInvoiceCount += 1;
    rows.push({
      id: item.invoice.id,
      invoiceNumber: item.invoice.invoice_number,
      invoiceDate: item.invoice.invoice_date,
      totalMinor: item.invoice.total_minor,
      currency: item.invoice.currency,
      status: item.status,
    });
  }

  return {
    currency: currencyOf(sortedInvoices),
    totalInvoicedMinor,
    outstandingBalanceMinor,
    paidInvoiceCount,
    invoiceCount: data.invoices.length,
    averageCollectionDays: collectionAverage(data),
    invoices: rows,
  };
}
