import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import { redirect } from 'remix/response/redirect';
import * as s from 'remix/data-schema';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import { findClient } from '../../../../data/clients.ts';
import type { Invoice, Organization } from '../../../../data/db.ts';
import { issueDraftInvoice } from '../../../../data/invoices/issuance.ts';
import { invoiceActivityData } from '../../../../data/invoices/payments.ts';
import { storeIssuedInvoicePdf } from '../../../../data/invoices/pdf-artifacts.ts';
import {
  discardDraftInvoice,
  findInvoice,
  findInvoiceLines,
  updateIssuedInvoiceInternalNote,
} from '../../../../data/invoices/records.ts';
import { authedUser, requireAuth } from '../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { INTERNAL_NOTE_MAX_LENGTH, InternalNoteForm } from '../public/schema.ts';
import { InvoiceShowPage } from '../show-page.tsx';
import type { InvoiceShowPageProps } from '../show-page.tsx';

/**
 * The request-context surface the shared error renderer needs: any request context plus the render
 * middleware's `context.render`. Controller middleware entries are appended, so the shape stays
 * wide rather than naming one controller's exact context type.
 */
type InvoiceShowRequestContext = RequestContext<AnyParams, ContextEntries> & {
  render: RenderFunction;
  db: SqliteDatabase;
};

/**
 * Validation failures reload the show page with the same Organization-scoped props, re-rendered as
 * a 400 so the client can correct the submission.
 */
async function renderInvoiceShowPageError(
  context: InvoiceShowRequestContext,
  organization: Organization,
  invoice: Invoice,
  pageProps: Pick<
    InvoiceShowPageProps,
    'validationErrors' | 'internalNoteValue' | 'internalNoteError'
  >,
) {
  let auth = authedUser(context);
  let [lines, client, paymentData] = await Promise.all([
    findInvoiceLines(context.db, organization.id, invoice.id),
    findClient(context.db, organization.id, invoice.client_id),
    invoiceActivityData(context.db, organization.id, invoice),
  ]);
  return context.render(
    <InvoiceShowPage
      csrfToken={getCsrfToken(context)}
      identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
      organizationName={organization.name}
      invoice={invoice}
      lines={lines}
      client={client}
      {...paymentData}
      {...pageProps}
    />,
    { status: 400 },
  );
}

export default createController(routes.app.invoices.lifecycle, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async issue(context) {
      let organization = context.get(CurrentOrganization);
      let result = await issueDraftInvoice(
        context.db,
        organization.id,
        context.params.invoiceId,
        storeIssuedInvoicePdf,
      );
      if (!result.ok && result.kind === 'not_found') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (!result.ok && result.kind === 'conflict') {
        return new Response('Only a Draft invoice can be issued', { status: 409 });
      }
      if (!result.ok) {
        let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
        if (!invoice) return new Response('Invoice not found', { status: 404 });
        return renderInvoiceShowPageError(context, organization, invoice, {
          validationErrors: result.errors,
        });
      }

      context.session.flash('message', 'Invoice marked as sent');
      return redirect(routes.app.invoices.show.href({ invoiceId: result.invoice.id }));
    },
    async discard(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be discarded', { status: 409 });
      }

      let discarded = await discardDraftInvoice(context.db, organization.id, invoice.id);
      if (!discarded) {
        return new Response('Only a Draft invoice can be discarded', { status: 409 });
      }

      context.session.flash('message', 'Invoice draft discarded');
      return redirect(routes.app.invoices.index.href());
    },
    async internalNote(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'issued') {
        return new Response('Internal notes can be updated only after issue', { status: 409 });
      }

      let parsed = s.parseSafe(InternalNoteForm, context.formData);
      let internalNote = parsed.success ? parsed.value.internal_note : '';
      if (!parsed.success || internalNote.length > INTERNAL_NOTE_MAX_LENGTH) {
        return renderInvoiceShowPageError(context, organization, invoice, {
          internalNoteValue: internalNote,
          internalNoteError: parsed.success
            ? 'Internal note must be 1,000 characters or fewer.'
            : 'Enter the internal note as text.',
        });
      }

      let updated = await updateIssuedInvoiceInternalNote(
        context.db,
        organization.id,
        invoice.id,
        internalNote.trim() || null,
      );
      if (!updated) {
        return new Response('Only an issued invoice can update its internal note', { status: 409 });
      }

      context.session.flash('message', 'Internal note updated');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
