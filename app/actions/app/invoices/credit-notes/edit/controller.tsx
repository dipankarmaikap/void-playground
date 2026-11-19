import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import {
  findCreditNote,
  findCreditNoteLines,
  remainingCreditNoteLineCapacity,
  updateCreditNoteDraft,
} from '../../../../../data/invoices/credit-notes.ts';
import type { CreditNoteDraftIssue } from '../../../../../data/invoices/credit-notes.ts';
import {
  creditNoteFormValuesOf,
} from '../../../../../data/invoices/credit-note-form-values.ts';
import type { CreditNoteFormValues } from '../../../../../data/invoices/credit-note-form-values.ts';
import type { Invoice, Organization, User } from '../../../../../data/db.ts';
import { findInvoice, findInvoiceLines } from '../../../../../data/invoices/records.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../../middleware/organization-context.ts';
import { todayInKolkata } from '../../../../../data/invoices/dates.ts';
import { routes } from '../../../../../routes.ts';
import { parseCreditNoteFormValues } from '../public/schema.ts';
import { CreditNoteDraftPage } from './page.tsx';

type CreditNoteEditRequestContext = RequestContext<AnyParams, ContextEntries> & {
  db: SqliteDatabase;
  formData: FormData;
  render: RenderFunction;
};

async function renderEditPage(
  context: CreditNoteEditRequestContext,
  organization: Organization,
  invoice: Invoice,
  values: CreditNoteFormValues,
  issues: readonly CreditNoteDraftIssue[] = [],
) {
  let auth = context.get(Auth) as GoodAuth<User>;
  let [lines, creditNote] = await Promise.all([
    findInvoiceLines(context.db, organization.id, invoice.id),
    findCreditNote(context.db, organization.id, invoice.id, context.params.creditNoteId),
  ]);
  let creditableQuantities = await remainingCreditNoteLineCapacity(
    context.db,
    organization.id,
    invoice,
    lines,
  );
  return context.render(
    <CreditNoteDraftPage
      csrfToken={getCsrfToken(context)}
      identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
      organizationName={organization.name}
      invoice={invoice}
      creditNote={creditNote ?? undefined}
      lines={lines}
      creditableQuantities={creditableQuantities}
      creditDate={todayInKolkata()}
      action={routes.app.invoices.creditNotes.edit.action.href({
        invoiceId: invoice.id,
        creditNoteId: context.params.creditNoteId,
      })}
      heading="Edit credit note draft"
      submitLabel="Save credit note draft"
      values={values}
      issues={issues}
    />,
    issues.length > 0 ? { status: 400 } : undefined,
  );
}

export default createController(routes.app.invoices.creditNotes.edit, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (invoice.status !== 'issued') {
        return new Response('Credit note Drafts require an issued invoice', { status: 409 });
      }
      let creditNote = await findCreditNote(
        context.db,
        organization.id,
        invoice.id,
        context.params.creditNoteId,
      );
      if (!creditNote) return new Response('Credit note not found', { status: 404 });
      if (creditNote.status !== 'draft') {
        return new Response('Issued credit notes cannot be edited', { status: 409 });
      }

      let [sourceLines, savedLines] = await Promise.all([
        findInvoiceLines(context.db, organization.id, invoice.id),
        findCreditNoteLines(context.db, organization.id, invoice.id, creditNote.id),
      ]);
      let creditableQuantities = await remainingCreditNoteLineCapacity(
        context.db,
        organization.id,
        invoice,
        sourceLines,
      );
      let auth = context.get(Auth) as GoodAuth<User>;
      let message = context.session.get('message');
      return context.render(
        <CreditNoteDraftPage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          invoice={invoice}
          creditNote={creditNote}
          lines={sourceLines}
          creditableQuantities={creditableQuantities}
          creditDate={todayInKolkata()}
          action={routes.app.invoices.creditNotes.edit.action.href({
            invoiceId: invoice.id,
            creditNoteId: creditNote.id,
          })}
          heading="Edit credit note draft"
          submitLabel="Save credit note draft"
          values={creditNoteFormValuesOf(creditNote, sourceLines, savedLines)}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (invoice.status !== 'issued') {
        return new Response('Credit note Drafts require an issued invoice', { status: 409 });
      }
      let values = parseCreditNoteFormValues(context.formData);
      let result = await updateCreditNoteDraft(
        context.db,
        organization.id,
        invoice.id,
        context.params.creditNoteId,
        values,
      );
      if (!result.ok && result.kind === 'not_found') {
        return new Response('Credit note not found', { status: 404 });
      }
      if (!result.ok && result.kind === 'conflict') {
        return new Response('Issued credit notes cannot be edited', { status: 409 });
      }
      if (!result.ok && result.kind === 'not_issued') {
        return new Response('Credit note Drafts require an issued invoice', { status: 409 });
      }
      if (!result.ok && result.kind === 'invalid') {
        return renderEditPage(context, organization, invoice, values, result.issues);
      }
      if (!result.ok) return new Response('Credit note Draft could not be updated', { status: 409 });

      context.session.flash('message', 'Credit note Draft updated');
      return redirect(
        routes.app.invoices.creditNotes.edit.index.href({
          invoiceId: invoice.id,
          creditNoteId: result.creditNote.id,
        }),
      );
    },
  },
});
