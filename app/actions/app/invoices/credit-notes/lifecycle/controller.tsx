import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import type { CreditNoteDraftIssue } from '../../../../../data/invoices/credit-notes.ts';
import {
  discardCreditNoteDraft,
  findCreditNote,
  findCreditNoteLines,
  issueCreditNoteDraft,
  remainingCreditNoteLineCapacity,
} from '../../../../../data/invoices/credit-notes.ts';
import { creditNoteFormValuesOf } from '../../../../../data/invoices/credit-note-form-values.ts';
import type { Invoice, Organization, User } from '../../../../../data/db.ts';
import { storeIssuedCreditNotePdf } from '../../../../../data/invoices/credit-note-pdf-artifacts.ts';
import { findInvoice, findInvoiceLines } from '../../../../../data/invoices/records.ts';
import { requireAuth } from '../../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../../middleware/organization-context.ts';
import { routes } from '../../../../../routes.ts';
import { CreditNoteDraftPage } from '../form-page.tsx';

type CreditNoteLifecycleRequestContext = RequestContext<AnyParams, ContextEntries> & {
  render: RenderFunction;
};

async function renderIssueError(
  context: CreditNoteLifecycleRequestContext,
  organization: Organization,
  invoice: Invoice,
  creditNoteId: string,
  message: string,
) {
  let [creditNote, sourceLines] = await Promise.all([
    findCreditNote(organization.id, invoice.id, creditNoteId),
    findInvoiceLines(organization.id, invoice.id),
  ]);
  if (!creditNote || creditNote.status !== 'draft') {
    return new Response(message, { status: 409 });
  }
  let savedLines = await findCreditNoteLines(organization.id, invoice.id, creditNote.id);
  let creditableQuantities = await remainingCreditNoteLineCapacity(
    organization.id,
    invoice,
    sourceLines,
  );
  let auth = context.get(Auth) as GoodAuth<User>;
  let issue: CreditNoteDraftIssue = { field: 'lines', message };
  return context.render(
    <CreditNoteDraftPage
      csrfToken={getCsrfToken(context)}
      identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
      organizationName={organization.name}
      invoice={invoice}
      creditNote={creditNote}
      lines={sourceLines}
      creditableQuantities={creditableQuantities}
      creditDate={creditNote.credit_date}
      action={routes.app.invoices.creditNotes.edit.action.href({
        invoiceId: invoice.id,
        creditNoteId: creditNote.id,
      })}
      heading="Edit credit note draft"
      submitLabel="Save credit note draft"
      values={creditNoteFormValuesOf(creditNote, sourceLines, savedLines)}
      issues={[issue]}
    />,
    { status: 400 },
  );
}

export default createController(routes.app.invoices.creditNotes.lifecycle, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async issue(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      let result = await issueCreditNoteDraft(
        organization.id,
        invoice.id,
        context.params.creditNoteId,
        storeIssuedCreditNotePdf,
      );
      if (!result.ok && result.kind === 'not_found') {
        return new Response('Credit note not found', { status: 404 });
      }
      if (!result.ok && result.kind === 'not_issued') {
        return new Response('Credit notes can be issued only for an issued invoice', {
          status: 409,
        });
      }
      if (!result.ok && result.kind === 'conflict') {
        return new Response('Only a Draft credit note can be issued', { status: 409 });
      }
      if (!result.ok && result.kind === 'over_limit') {
        return renderIssueError(
          context,
          organization,
          invoice,
          context.params.creditNoteId,
          'Cumulative issued credit notes cannot exceed the original invoice value.',
        );
      }
      if (!result.ok) {
        return renderIssueError(
          context,
          organization,
          invoice,
          context.params.creditNoteId,
          'Credit note details are invalid.',
        );
      }

      context.session.flash('message', 'Credit note issued');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
    async discard(context) {
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
      if (creditNote.status !== 'draft') {
        return new Response('Issued credit notes cannot be discarded', { status: 409 });
      }

      let discarded = await discardCreditNoteDraft(
        organization.id,
        invoice.id,
        creditNote.id,
      );
      if (!discarded) {
        return new Response('Only a Credit Note Draft can be discarded', { status: 409 });
      }

      context.session.flash('message', 'Credit note Draft discarded');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
