import type { Database } from 'remix/data-table';

import { creditNotePdfArtifacts } from './db.ts';
import type { CreditNote, CreditNoteLine } from './db.ts';
import type { InvoicePdfDocument } from './invoice-pdf.ts';
import {
  renderCreditNotePdf,
  sellerFromInvoiceSnapshot,
} from './invoice-pdf.ts';

export interface IssuedCreditNoteFinalizerContext {
  transaction: Database;
  invoice: InvoicePdfDocument;
  creditNote: CreditNote;
  lines: readonly CreditNoteLine[];
}

export type IssuedCreditNoteFinalizer = (
  context: IssuedCreditNoteFinalizerContext,
) => Promise<void>;

/** A safe Content-Disposition filename for a Draft or numbered Credit Note. */
export function creditNotePdfFilename(
  creditNote: Pick<CreditNote, 'status' | 'credit_note_number'>,
): string {
  let base =
    creditNote.status === 'draft' || !creditNote.credit_note_number
      ? 'credit-note-draft'
      : creditNote.credit_note_number;
  let cleaned = base
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .trim();
  return `${cleaned || 'credit-note'}.pdf`;
}

/** Captures the English PDF bytes in the same transaction as numbering and issuance. */
export const storeIssuedCreditNotePdf: IssuedCreditNoteFinalizer = async ({
  transaction,
  invoice,
  creditNote,
  lines,
}) => {
  let pdf = renderCreditNotePdf({
    invoice,
    creditNote,
    lines,
    seller: sellerFromInvoiceSnapshot(invoice),
    watermark: false,
  });
  let now = Date.now();
  await transaction.create(creditNotePdfArtifacts, {
    id: crypto.randomUUID(),
    organization_id: creditNote.organization_id,
    invoice_id: creditNote.invoice_id,
    credit_note_id: creditNote.id,
    data: pdf,
    created_at: now,
    updated_at: now,
  });
};
