/**
 * Storage for the immutable issued-invoice PDF artifact. The final PDF is generated inside the
 * issue transaction through #47's finalizer seam, so the exact bytes captured at issue time commit
 * atomically with the number allocation and seller snapshots — and every future download returns
 * those bytes verbatim.
 */

import { db, invoicePdfArtifacts } from './db.ts';
import type { Invoice } from './db.ts';
import type { IssuedInvoiceFinalizer } from './invoice-issuance.ts';
import { renderInvoicePdf, sellerFromInvoiceSnapshot } from './invoice-pdf.ts';

/** A safe `Content-Disposition` filename for an invoice's PDF, with `/` and other hazards removed. */
export function invoicePdfFilename(
  invoice: Pick<Invoice, 'status' | 'invoice_number'>,
): string {
  let base =
    invoice.status === 'draft' || !invoice.invoice_number
      ? 'invoice-draft'
      : invoice.invoice_number;
  let cleaned = base
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .trim();
  return `${cleaned || 'invoice'}.pdf`;
}

/** Reads the exact stored PDF bytes for an issued invoice, scoped to the Organization. */
export function findIssuedInvoicePdfBytes(
  organizationId: string,
  invoiceId: string,
): Promise<Uint8Array | null> {
  return db
    .findOne(invoicePdfArtifacts, {
      where: { organization_id: organizationId, invoice_id: invoiceId },
    })
    .then((artifact) => (artifact?.data as Uint8Array | undefined) ?? null);
}

/**
 * The issue-time finalizer: renders the final (non-watermarked) PDF from the just-snapshotted
 * invoice and lines, and stores it in the same-Organization artifact row before the transaction
 * commits. Any failure rejects the whole issue, rolling back the number and snapshots.
 */
export const storeIssuedInvoicePdf: IssuedInvoiceFinalizer = async ({
  transaction,
  invoice,
  lines,
}) => {
  let pdf = renderInvoicePdf({
    invoice,
    lines,
    seller: sellerFromInvoiceSnapshot(invoice),
    watermark: false,
  });
  let now = Date.now();
  await transaction.create(invoicePdfArtifacts, {
    id: crypto.randomUUID(),
    organization_id: invoice.organization_id,
    invoice_id: invoice.id,
    data: pdf,
    created_at: now,
    updated_at: now,
  });
};
