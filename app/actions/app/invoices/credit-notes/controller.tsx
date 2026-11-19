import { createController } from 'remix/router';

import {
  findCreditNote,
  findCreditNoteLines,
  findIssuedCreditNotePdfBytes,
} from '../../../../data/invoices/credit-notes.ts';
import {
  renderCreditNotePdf,
  sellerFromInvoiceSnapshot,
} from '../../../../data/invoices/pdf.ts';
import { creditNotePdfFilename } from '../../../../data/invoices/credit-note-pdf-artifacts.ts';
import { findInvoice } from '../../../../data/invoices/records.ts';
import { requireAuth } from '../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';

export default createController(routes.app.invoices.creditNotes, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async pdf(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      let creditNote = await findCreditNote(
        organization.id,
        invoice.id,
        context.params.creditNoteId,
      );
      if (!creditNote) return new Response('Credit note not found', { status: 404 });

      let filename = creditNotePdfFilename(creditNote);
      let headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      };

      if (creditNote.status === 'issued') {
        let bytes = await findIssuedCreditNotePdfBytes(
          organization.id,
          invoice.id,
          creditNote.id,
        );
        if (!bytes) return new Response('Credit note PDF not found', { status: 404 });
        return new Response(new Blob([bytes as BlobPart]), { headers });
      }

      if (invoice.status !== 'issued') {
        return new Response('Credit note PDF not found', { status: 404 });
      }
      let { internal_note: _internalNote, ...invoiceDocument } = invoice;
      let lines = await findCreditNoteLines(organization.id, invoice.id, creditNote.id);
      let pdf = renderCreditNotePdf({
        invoice: invoiceDocument,
        creditNote,
        lines,
        seller: sellerFromInvoiceSnapshot(invoiceDocument),
        watermark: true,
      });
      return new Response(new Blob([pdf as BlobPart]), { headers });
    },
  },
});
