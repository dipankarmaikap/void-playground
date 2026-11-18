import { db, creditNotes, invoicePayments, invoiceRefunds, invoices } from '../db.ts';
import type { CreditNote, Invoice, InvoicePayment, InvoiceRefund } from '../db.ts';
import { findInvoiceCreditNotes } from './credit-notes.ts';
import { isValidIsoDate } from './dates.ts';
import {
  INVOICE_MONEY_MOVEMENT_METHODS,
  invoiceMoneyMovementMethodLabel,
  isInvoiceMoneyMovementMethod,
  parseMoneyMovementAmount,
} from './money-movements.ts';
import type { InvoiceMoneyMovementMethod } from './money-movements.ts';
import { findInvoiceRefunds, invoiceFinancialBalances } from './refunds.ts';

export const INVOICE_PAYMENT_METHODS = INVOICE_MONEY_MOVEMENT_METHODS;

export type InvoicePaymentMethod = InvoiceMoneyMovementMethod;

export interface InvoicePaymentInput {
  paymentDate: string;
  amountMinor: number;
  method: InvoicePaymentMethod;
  reference: string | null;
}

export interface InvoicePaymentSummary {
  /** Sum of active (non-voided) payment entries. */
  amountPaidMinor: number;
  /** Sum of active (non-voided) refund entries. */
  activeRefundedMinor: number;
  /** Active payments minus active refunds. */
  netPaidMinor: number;
  creditedTotalMinor: number;
  revisedTotalMinor: number;
  balanceDueMinor: number;
  refundDueMinor: number;
}

/**
 * The payments, refunds, and Credit Notes recorded against one Invoice, with the totals
 * they derive. This is the Invoice detail read model: pages compose it instead of
 * restating its fields.
 */
export interface InvoiceActivityData extends InvoicePaymentSummary {
  payments: InvoicePayment[];
  refunds: InvoiceRefund[];
  creditNotes: CreditNote[];
}

export type RecordInvoicePaymentResult =
  | { ok: true; payment: InvoicePayment }
  | {
      ok: false;
      kind: 'not_found' | 'not_issued' | 'no_balance' | 'invalid_payment' | 'over_balance';
    };

export type VoidInvoicePaymentResult =
  | { ok: true }
  | {
      ok: false;
      kind:
        | 'not_found'
        | 'not_issued'
        | 'invalid_reason'
        | 'already_voided'
        | 'refunds_exceed_remaining_payments';
    };

export const isInvoicePaymentMethod = isInvoiceMoneyMovementMethod;
export const invoicePaymentMethodLabel = invoiceMoneyMovementMethodLabel;
export const parsePaymentAmount = parseMoneyMovementAmount;

export function summarizeInvoicePayments(
  invoice: Pick<Invoice, 'total_minor'>,
  payments: readonly InvoicePayment[],
  creditedTotalMinor = 0,
  refunds: readonly InvoiceRefund[] = [],
): InvoicePaymentSummary {
  let amountPaidMinor = payments.reduce(
    (total, payment) => total + (payment.voided_at === null ? payment.amount_minor : 0),
    0,
  );
  let activeRefundedMinor = refunds.reduce(
    (total, refund) => total + (refund.voided_at === null ? refund.amount_minor : 0),
    0,
  );
  return {
    amountPaidMinor,
    activeRefundedMinor,
    ...invoiceFinancialBalances(
      invoice.total_minor,
      creditedTotalMinor,
      amountPaidMinor,
      activeRefundedMinor,
    ),
    creditedTotalMinor,
  };
}

/** Returns every payment entry, including voided entries, in the Organization-scoped history. */
export function findInvoicePayments(
  organizationId: string,
  invoiceId: string,
): Promise<InvoicePayment[]> {
  return db.findMany(invoicePayments, {
    where: { organization_id: organizationId, invoice_id: invoiceId },
    orderBy: [
      ['payment_date', 'asc'],
      ['created_at', 'asc'],
      ['id', 'asc'],
    ],
  });
}

export async function invoiceActivityData(
  organizationId: string,
  invoice: Invoice,
): Promise<InvoiceActivityData> {
  let [payments, creditNotes, refunds] = await Promise.all([
    findInvoicePayments(organizationId, invoice.id),
    findInvoiceCreditNotes(organizationId, invoice.id),
    findInvoiceRefunds(organizationId, invoice.id),
  ]);
  let creditedTotalMinor = creditNotes.reduce(
    (total, note) => total + (note.status === 'issued' ? note.total_minor : 0),
    0,
  );
  return {
    payments,
    creditNotes,
    refunds,
    ...summarizeInvoicePayments(invoice, payments, creditedTotalMinor, refunds),
  };
}

/** Active totals support the invoice directory's read-time derived statuses. */
export async function activeInvoicePaymentTotals(
  organizationId: string,
): Promise<Map<string, number>> {
  let payments = await db.findMany(invoicePayments, {
    where: { organization_id: organizationId, voided_at: null },
  });
  let totals = new Map<string, number>();
  for (let payment of payments) {
    totals.set(
      payment.invoice_id,
      (totals.get(payment.invoice_id) ?? 0) + payment.amount_minor,
    );
  }
  return totals;
}

/** Records a confirmed payment only while the current issued invoice has enough balance due. */
export async function recordInvoicePayment(
  organizationId: string,
  invoiceId: string,
  input: InvoicePaymentInput,
): Promise<RecordInvoicePaymentResult> {
  if (
    !isValidIsoDate(input.paymentDate) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !isInvoicePaymentMethod(input.method) ||
    (input.reference !== null && input.reference.length > 200)
  ) {
    return { ok: false, kind: 'invalid_payment' };
  }

  let id = crypto.randomUUID();
  let now = Date.now();
  return db.transaction(async (transaction) => {
    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;

    let [payments, refunds, issuedCreditNotes] = await Promise.all([
      transaction.findMany(invoicePayments, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
      }),
      transaction.findMany(invoiceRefunds, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
      }),
      transaction.findMany(creditNotes, {
        where: {
          organization_id: organizationId,
          invoice_id: invoiceId,
          status: 'issued',
        },
      }),
    ]);
    let creditedTotalMinor = issuedCreditNotes.reduce(
      (total, creditNote) => total + creditNote.total_minor,
      0,
    );
    let { balanceDueMinor } = summarizeInvoicePayments(
      invoice,
      payments,
      creditedTotalMinor,
      refunds,
    );
    if (balanceDueMinor <= 0) return { ok: false, kind: 'no_balance' } as const;
    if (input.amountMinor > balanceDueMinor) {
      return { ok: false, kind: 'over_balance' } as const;
    }

    let payment: InvoicePayment = {
      id,
      organization_id: organizationId,
      invoice_id: invoiceId,
      payment_date: input.paymentDate,
      amount_minor: input.amountMinor,
      payment_method: input.method,
      reference: input.reference?.trim() || null,
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
    };
    await transaction.create(invoicePayments, payment);
    return { ok: true, payment } as const;
  });
}

/** Voids a payment without deleting it so the invoice retains its audit history. */
export async function voidInvoicePayment(
  organizationId: string,
  invoiceId: string,
  paymentId: string,
  reason: string,
): Promise<VoidInvoicePaymentResult> {
  let trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > 1000) {
    return { ok: false, kind: 'invalid_reason' };
  }

  let now = Date.now();
  return db.transaction(async (transaction) => {
    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;

    let payment = await transaction.findOne(invoicePayments, {
      where: {
        id: paymentId,
        organization_id: organizationId,
        invoice_id: invoiceId,
      },
    });
    if (!payment) return { ok: false, kind: 'not_found' } as const;
    if (payment.voided_at !== null) return { ok: false, kind: 'already_voided' } as const;

    let [activePayments, activeRefunds] = await Promise.all([
      transaction.findMany(invoicePayments, {
        where: { organization_id: organizationId, invoice_id: invoiceId, voided_at: null },
      }),
      transaction.findMany(invoiceRefunds, {
        where: { organization_id: organizationId, invoice_id: invoiceId, voided_at: null },
      }),
    ]);
    let remainingActivePaymentsMinor =
      activePayments.reduce((total, entry) => total + entry.amount_minor, 0) - payment.amount_minor;
    let activeRefundedMinor = activeRefunds.reduce(
      (total, refund) => total + refund.amount_minor,
      0,
    );
    if (remainingActivePaymentsMinor < activeRefundedMinor) {
      return { ok: false, kind: 'refunds_exceed_remaining_payments' } as const;
    }

    let updated = await transaction.updateMany(
      invoicePayments,
      { voided_at: now, void_reason: trimmedReason, updated_at: now },
      {
        where: {
          id: paymentId,
          organization_id: organizationId,
          invoice_id: invoiceId,
          voided_at: null,
        },
        limit: 1,
      },
    );
    if (updated.affectedRows === 0) return { ok: false, kind: 'already_voided' } as const;
    return { ok: true } as const;
  });
}
