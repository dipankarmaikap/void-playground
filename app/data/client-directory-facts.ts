import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { clients, invoicePayments, invoices } from './db.ts';
import type { Invoice } from './db.ts';
import type { ClientStatus } from './client-status.ts';
import { todayInKolkata } from './invoices/dates.ts';
import type { InvoiceDisplayStatus } from './invoices/issuance.ts';
import { invoiceDisplayStatus } from './invoices/issuance.ts';
import { activeInvoiceCreditNoteTotals } from './invoices/credit-notes.ts';
import { activeInvoicePaymentTotals } from './invoices/payments.ts';
import { activeInvoiceRefundTotals, invoiceFinancialBalances } from './invoices/refunds.ts';

export interface ClientDirectorySummary {
  /** Active Clients belonging to this Organization. */
  activeClientCount: number;
  /** Net balance due across this Organization's real invoice documents, in minor units. */
  outstandingBalanceMinor: number;
  /** Clients created during the current Kolkata calendar month. */
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

const MS_PER_DAY = 86_400_000;

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
  let [organizationClients, organizationInvoices, paymentTotals, creditTotals, refundTotals, payments] =
    await Promise.all([
      db.findMany(clients, { where: { organization_id: organizationId } }),
      db.findMany(invoices, {
        where: { organization_id: organizationId, document_type: 'invoice' },
      }),
      activeInvoicePaymentTotals(db, organizationId),
      activeInvoiceCreditNoteTotals(db, organizationId),
      activeInvoiceRefundTotals(db, organizationId),
      db.findMany(invoicePayments, {
        where: { organization_id: organizationId, voided_at: null },
      }),
    ]);

  let invoiceById = new Map<string, Invoice>(organizationInvoices.map((invoice) => [invoice.id, invoice]));
  let clientFacts = new Map<string, ClientFacts>();
  let monthPrefix = today.slice(0, 7);
  let activeClientCount = 0;
  let newClientsThisMonth = 0;

  for (let client of organizationClients) {
    if (client.status === 'active') activeClientCount += 1;
    if (todayInKolkata(new Date(client.created_at)).slice(0, 7) === monthPrefix) {
      newClientsThisMonth += 1;
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

  let currency = [...organizationInvoices]
    .sort((a, b) =>
      `${b.invoice_date}|${b.created_at}|${b.id}`.localeCompare(`${a.invoice_date}|${a.created_at}|${a.id}`),
    )[0]?.currency ?? 'INR';

  let outstandingBalanceMinor = 0;
  for (let invoice of organizationInvoices) {
    let creditedTotalMinor = creditTotals.get(invoice.id) ?? 0;
    let balances = invoiceFinancialBalances(
      invoice.total_minor,
      creditedTotalMinor,
      paymentTotals.get(invoice.id) ?? 0,
      refundTotals.get(invoice.id) ?? 0,
    );
    outstandingBalanceMinor += balances.balanceDueMinor;

    let facts = clientFacts.get(invoice.client_id);
    if (!facts) continue;
    let status = invoiceDisplayStatus(invoice, balances.netPaidMinor, today, creditedTotalMinor);
    facts.invoiceCount += 1;
    facts.outstandingBalanceMinor += balances.balanceDueMinor;
    if (facts.lastInvoiceDate === null || invoice.invoice_date > facts.lastInvoiceDate) {
      facts.lastInvoiceDate = invoice.invoice_date;
      facts.status = status;
    }
    if (status === 'overdue') facts.hasOverdueInvoice = true;
  }

  let totalCollectionDays = 0;
  let collectionSampleCount = 0;
  for (let payment of payments) {
    let invoice = invoiceById.get(payment.invoice_id);
    if (!invoice) continue;
    let days = daysBetween(invoice.invoice_date, payment.payment_date);
    if (days === null) continue;
    totalCollectionDays += days;
    collectionSampleCount += 1;
  }

  return {
    summary: {
      activeClientCount,
      outstandingBalanceMinor,
      newClientsThisMonth,
      currency,
      averageCollectionDays:
        collectionSampleCount === 0
          ? null
          : Math.round((totalCollectionDays / collectionSampleCount) * 10) / 10,
    },
    clients: clientFacts,
  };
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
  let [organizationInvoices, paymentTotals, creditTotals, refundTotals, payments] =
    await Promise.all([
      db.findMany(invoices, {
        where: {
          organization_id: organizationId,
          client_id: clientId,
          document_type: 'invoice',
        },
      }),
      activeInvoicePaymentTotals(db, organizationId),
      activeInvoiceCreditNoteTotals(db, organizationId),
      activeInvoiceRefundTotals(db, organizationId),
      db.findMany(invoicePayments, {
        where: { organization_id: organizationId, voided_at: null },
      }),
    ]);

  let invoiceById = new Map<string, Invoice>(organizationInvoices.map((invoice) => [invoice.id, invoice]));
  let currency =
    [...organizationInvoices]
      .sort((a, b) =>
        `${b.invoice_date}|${b.created_at}|${b.id}`.localeCompare(
          `${a.invoice_date}|${a.created_at}|${a.id}`,
        ),
      )[0]?.currency ?? 'INR';

  let totalInvoicedMinor = 0;
  let outstandingBalanceMinor = 0;
  let paidInvoiceCount = 0;
  let rows: ClientInvoiceRow[] = [];

  for (let invoice of organizationInvoices) {
    let creditedTotalMinor = creditTotals.get(invoice.id) ?? 0;
    let balances = invoiceFinancialBalances(
      invoice.total_minor,
      creditedTotalMinor,
      paymentTotals.get(invoice.id) ?? 0,
      refundTotals.get(invoice.id) ?? 0,
    );
    let status = invoiceDisplayStatus(invoice, balances.netPaidMinor, today, creditedTotalMinor);
    totalInvoicedMinor += invoice.total_minor;
    outstandingBalanceMinor += balances.balanceDueMinor;
    if (status === 'paid') paidInvoiceCount += 1;
    rows.push({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      totalMinor: invoice.total_minor,
      currency: invoice.currency,
      status,
    });
  }

  rows.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.id.localeCompare(b.id));

  let totalCollectionDays = 0;
  let collectionSampleCount = 0;
  for (let payment of payments) {
    let invoice = invoiceById.get(payment.invoice_id);
    if (!invoice) continue;
    let days = daysBetween(invoice.invoice_date, payment.payment_date);
    if (days === null) continue;
    totalCollectionDays += days;
    collectionSampleCount += 1;
  }

  return {
    currency,
    totalInvoicedMinor,
    outstandingBalanceMinor,
    paidInvoiceCount,
    invoiceCount: organizationInvoices.length,
    averageCollectionDays:
      collectionSampleCount === 0
        ? null
        : Math.round((totalCollectionDays / collectionSampleCount) * 10) / 10,
    invoices: rows,
  };
}

/** Whole UTC calendar days between two ISO dates; anomalous negative intervals are ignored. */
function daysBetween(invoiceDate: string, paymentDate: string): number | null {
  let start = Date.parse(`${invoiceDate}T00:00:00Z`);
  let end = Date.parse(`${paymentDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / MS_PER_DAY);
}
