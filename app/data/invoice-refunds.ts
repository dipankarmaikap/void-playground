import {
  creditNotes,
  db,
  invoicePayments,
  invoiceRefunds,
  invoices,
} from './db.ts';
import type { InvoiceRefund } from './db.ts';
import { isValidIsoDate } from './invoice-dates.ts';
import {
  INVOICE_MONEY_MOVEMENT_METHODS,
  invoiceMoneyMovementMethodLabel,
  isInvoiceMoneyMovementMethod,
  parseMoneyMovementAmount,
} from './invoice-money-movements.ts';
import type { InvoiceMoneyMovementMethod } from './invoice-money-movements.ts';

/** The same seven rails as invoice payments; refunds reuse their labels in the UI. */
export const INVOICE_REFUND_METHODS = INVOICE_MONEY_MOVEMENT_METHODS;

export type InvoiceRefundMethod = InvoiceMoneyMovementMethod;

export interface InvoiceRefundInput {
  refundDate: string;
  amountMinor: number;
  method: InvoiceRefundMethod;
  reference: string | null;
}

/**
 * The full balance model shared by refund validation and the invoice payment summary. Payments and
 * refunds are already active-only totals when passed in; credited totals come from issued notes.
 */
export function invoiceFinancialBalances(
  totalMinor: number,
  creditedTotalMinor: number,
  activePaidMinor: number,
  activeRefundedMinor: number,
) {
  let revisedTotalMinor = Math.max(0, totalMinor - creditedTotalMinor);
  let netPaidMinor = activePaidMinor - activeRefundedMinor;
  return {
    revisedTotalMinor,
    netPaidMinor,
    balanceDueMinor: Math.max(0, revisedTotalMinor - netPaidMinor),
    refundDueMinor: Math.max(0, netPaidMinor - revisedTotalMinor),
  };
}

export const isInvoiceRefundMethod = isInvoiceMoneyMovementMethod;
export const refundMethodLabel = invoiceMoneyMovementMethodLabel;
export const parseRefundAmount = parseMoneyMovementAmount;

/** Returns every refund entry, including voided entries, in the Organization-scoped history. */
export function findInvoiceRefunds(
  organizationId: string,
  invoiceId: string,
): Promise<InvoiceRefund[]> {
  return db.findMany(invoiceRefunds, {
    where: { organization_id: organizationId, invoice_id: invoiceId },
    orderBy: [
      ['refund_date', 'asc'],
      ['created_at', 'asc'],
      ['id', 'asc'],
    ],
  });
}

/** Active refund totals support the invoice directory's read-time derived refund-due amount. */
export async function activeInvoiceRefundTotals(
  organizationId: string,
): Promise<Map<string, number>> {
  let refunds = await db.findMany(invoiceRefunds, {
    where: { organization_id: organizationId, voided_at: null },
  });
  let totals = new Map<string, number>();
  for (let refund of refunds) {
    totals.set(
      refund.invoice_id,
      (totals.get(refund.invoice_id) ?? 0) + refund.amount_minor,
    );
  }
  return totals;
}

export type RecordInvoiceRefundResult =
  | { ok: true; refund: InvoiceRefund }
  | {
      ok: false;
      kind:
        | 'not_found'
        | 'not_issued'
        | 'invalid_refund'
        | 'no_refund_due'
        | 'over_refund_due';
    };

export type VoidInvoiceRefundResult =
  | { ok: true }
  | { ok: false; kind: 'not_found' | 'not_issued' | 'invalid_reason' | 'already_voided' };

/** Records a manual refund only while the issued invoice still has enough refund due. */
export async function recordInvoiceRefund(
  organizationId: string,
  invoiceId: string,
  input: InvoiceRefundInput,
): Promise<RecordInvoiceRefundResult> {
  if (
    !isValidIsoDate(input.refundDate) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !isInvoiceRefundMethod(input.method) ||
    (input.reference !== null && input.reference.length > 200)
  ) {
    return { ok: false, kind: 'invalid_refund' };
  }

  let id = crypto.randomUUID();
  let now = Date.now();
  return db.transaction(async (transaction) => {
    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;

    let [payments, refunds, notes] = await Promise.all([
      transaction.findMany(invoicePayments, {
        where: { organization_id: organizationId, invoice_id: invoiceId, voided_at: null },
      }),
      transaction.findMany(invoiceRefunds, {
        where: { organization_id: organizationId, invoice_id: invoiceId, voided_at: null },
      }),
      transaction.findMany(creditNotes, {
        where: { organization_id: organizationId, invoice_id: invoiceId, status: 'issued' },
      }),
    ]);
    let activePaidMinor = payments.reduce((total, payment) => total + payment.amount_minor, 0);
    let activeRefundedMinor = refunds.reduce((total, refund) => total + refund.amount_minor, 0);
    let creditedTotalMinor = notes.reduce((total, note) => total + note.total_minor, 0);
    let { refundDueMinor } = invoiceFinancialBalances(
      invoice.total_minor,
      creditedTotalMinor,
      activePaidMinor,
      activeRefundedMinor,
    );
    if (refundDueMinor <= 0) return { ok: false, kind: 'no_refund_due' } as const;
    if (input.amountMinor > refundDueMinor) {
      return { ok: false, kind: 'over_refund_due' } as const;
    }

    let refund: InvoiceRefund = {
      id,
      organization_id: organizationId,
      invoice_id: invoiceId,
      refund_date: input.refundDate,
      amount_minor: input.amountMinor,
      refund_method: input.method,
      reference: input.reference?.trim() || null,
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
    };
    await transaction.create(invoiceRefunds, refund);
    return { ok: true, refund } as const;
  });
}

/**
 * Voids a refund without deleting it so the invoice retains its audit history.
 *
 * No payment/credit invariant guard is needed here: voiding only removes the refund from the
 * active refund total, so net paid increases while stored payments and credited totals stay
 * unchanged. Credits therefore still cannot exceed the original invoice total, and both balance
 * due and refund due are clamped at zero by `invoiceFinancialBalances`, so neither can go negative.
 * The only effect is the intended one: refund due grows back by the voided amount.
 */
export async function voidInvoiceRefund(
  organizationId: string,
  invoiceId: string,
  refundId: string,
  reason: string,
): Promise<VoidInvoiceRefundResult> {
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

    let refund = await transaction.findOne(invoiceRefunds, {
      where: { id: refundId, organization_id: organizationId, invoice_id: invoiceId },
    });
    if (!refund) return { ok: false, kind: 'not_found' } as const;
    if (refund.voided_at !== null) return { ok: false, kind: 'already_voided' } as const;

    let updated = await transaction.updateMany(
      invoiceRefunds,
      { voided_at: now, void_reason: trimmedReason, updated_at: now },
      {
        where: {
          id: refundId,
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
