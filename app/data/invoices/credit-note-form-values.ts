import type { CreditNote, CreditNoteLine, Invoice, InvoiceLine } from '../db.ts';

export interface CreditNoteLineInput {
  invoice_line_id: string;
  quantity: string;
}

export interface CreditNoteFormValues {
  credit_date: string;
  reason: string;
  lines: CreditNoteLineInput[];
}

export type CreditNoteDraftInput = CreditNoteFormValues;

/** Prefills every still-creditable original service line for a new Credit Note Draft. */
export function newCreditNoteFormValues(
  invoice: Pick<Invoice, 'invoice_date'>,
  lines: readonly InvoiceLine[],
  today: string,
  remainingQuantities: ReadonlyMap<string, string> = new Map(),
): CreditNoteFormValues {
  return {
    credit_date: today < invoice.invoice_date ? invoice.invoice_date : today,
    reason: '',
    lines: lines.map((line) => ({
      invoice_line_id: line.id,
      quantity: remainingQuantities.get(line.id) ?? line.quantity,
    })),
  };
}

/** Rebuilds form values from a saved Draft without dropping unselected source lines. */
export function creditNoteFormValuesOf(
  creditNote: CreditNote,
  sourceLines: readonly InvoiceLine[],
  savedLines: readonly CreditNoteLine[],
): CreditNoteFormValues {
  let quantityBySource = new Map(
    savedLines.map((line) => [line.invoice_line_id, line.quantity]),
  );
  return {
    credit_date: creditNote.credit_date,
    reason: creditNote.reason,
    lines: sourceLines.map((line) => ({
      invoice_line_id: line.id,
      quantity: quantityBySource.get(line.id) ?? '',
    })),
  };
}
