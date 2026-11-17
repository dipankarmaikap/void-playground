import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { issueDraftInvoice } from '../../../../data/invoice-issuance.ts';
import {
  discardDraftInvoice,
  findInvoice,
  findInvoiceLines,
  updateIssuedInvoiceInternalNote,
} from '../../../../data/invoices.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { InvoiceShowPage } from '../show-page.tsx';

export default createController(routes.app.invoices.lifecycle, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async issue(context) {
      let organization = context.get(CurrentOrganization);
      let result = await issueDraftInvoice(organization.id, context.params.invoiceId);
      if (!result.ok && result.kind === 'not_found') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (!result.ok && result.kind === 'conflict') {
        return new Response('Only a Draft invoice can be issued', { status: 409 });
      }
      if (!result.ok) {
        let auth = context.get(Auth) as GoodAuth<User>;
        let invoice = await findInvoice(organization.id, context.params.invoiceId);
        if (!invoice) return new Response('Invoice not found', { status: 404 });
        let [lines, client] = await Promise.all([
          findInvoiceLines(organization.id, invoice.id),
          findClient(organization.id, invoice.client_id),
        ]);
        return context.render(
          <InvoiceShowPage
            csrfToken={getCsrfToken(context)}
            identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
            organizationName={organization.name}
            invoice={invoice}
            lines={lines}
            client={client}
            validationErrors={result.errors}
          />,
          { status: 400 },
        );
      }

      context.session.flash('message', 'Invoice marked as sent');
      return redirect(routes.app.invoices.show.href({ invoiceId: result.invoice.id }));
    },
    async discard(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be discarded', { status: 409 });
      }

      let discarded = await discardDraftInvoice(organization.id, invoice.id);
      if (!discarded) {
        return new Response('Only a Draft invoice can be discarded', { status: 409 });
      }

      context.session.flash('message', 'Invoice draft discarded');
      return redirect(routes.app.invoices.index.href());
    },
    async internalNote(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'issued') {
        return new Response('Internal notes can be updated only after issue', { status: 409 });
      }

      let submittedNote = context.formData.get('internal_note');
      let internalNote = typeof submittedNote === 'string' ? submittedNote : '';
      if (typeof submittedNote !== 'string' || internalNote.length > 1000) {
        let auth = context.get(Auth) as GoodAuth<User>;
        let [lines, client] = await Promise.all([
          findInvoiceLines(organization.id, invoice.id),
          findClient(organization.id, invoice.client_id),
        ]);
        return context.render(
          <InvoiceShowPage
            csrfToken={getCsrfToken(context)}
            identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
            organizationName={organization.name}
            invoice={invoice}
            lines={lines}
            client={client}
            internalNoteValue={internalNote}
            internalNoteError={
              typeof submittedNote === 'string'
                ? 'Internal note must be 1,000 characters or fewer.'
                : 'Enter the internal note as text.'
            }
          />,
          { status: 400 },
        );
      }

      let updated = await updateIssuedInvoiceInternalNote(
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
