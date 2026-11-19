import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import {
  createCreditNoteDraft,
  remainingCreditNoteLineCapacity,
  remainingCreditableValue,
} from '../../../../../data/invoices/credit-notes.ts';
import type { CreditNoteDraftIssue } from '../../../../../data/invoices/credit-notes.ts';
import {
  newCreditNoteFormValues,
  readCreditNoteFormValues,
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
import { CreditNoteDraftPage } from './page.tsx';

type CreditNoteRequestContext = RequestContext<AnyParams, ContextEntries> & {
  db: SqliteDatabase;
  formData: FormData;
  render: RenderFunction;
};

async function renderCreditNoteForm(
  context: CreditNoteRequestContext,
  organization: Organization,
  invoice: Invoice,
  values: CreditNoteFormValues,
  issues: readonly CreditNoteDraftIssue[] = [],
) {
  let auth = context.get(Auth) as GoodAuth<User>;
  let lines = await findInvoiceLines(context.db, organization.id, invoice.id);
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
      lines={lines}
      creditableQuantities={creditableQuantities}
      creditDate={todayInKolkata()}
      action={routes.app.invoices.creditNotes.new.action.href({ invoiceId: invoice.id })}
      heading="New credit note draft"
      submitLabel="Create credit note draft"
      values={values}
      issues={issues}
    />,
    issues.length > 0 ? { status: 400 } : undefined,
  );
}

export default createController(routes.app.invoices.creditNotes.new, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let organization = context.get(CurrentOrganization);
      let auth = context.get(Auth) as GoodAuth<User>;
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (invoice.status !== 'issued') {
        return new Response('Credit notes can be created only for issued invoices', {
          status: 409,
        });
      }
      if (
        (await remainingCreditableValue(context.db, organization.id, invoice.id, invoice.total_minor)) <= 0
      ) {
        return new Response('This invoice has no remaining creditable value', { status: 409 });
      }

      let lines = await findInvoiceLines(context.db, organization.id, invoice.id);
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
          lines={lines}
          creditableQuantities={creditableQuantities}
          creditDate={todayInKolkata()}
          action={routes.app.invoices.creditNotes.new.action.href({
            invoiceId: invoice.id,
          })}
          heading="New credit note draft"
          submitLabel="Create credit note draft"
          values={newCreditNoteFormValues(
            invoice,
            lines,
            todayInKolkata(),
            new Map(
              [...creditableQuantities].map(([lineId, capacity]) => [
                lineId,
                capacity.quantity,
              ]),
            ),
          )}
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
        return new Response('Credit notes can be created only for issued invoices', {
          status: 409,
        });
      }

      let values = readCreditNoteFormValues(context.formData);
      let result = await createCreditNoteDraft(context.db, organization.id, invoice.id, values);
      if (!result.ok && result.kind === 'not_found') {
        return new Response('Invoice not found', { status: 404 });
      }
      if (!result.ok && result.kind === 'not_issued') {
        return new Response('Credit notes can be created only for issued invoices', {
          status: 409,
        });
      }
      if (!result.ok && result.kind === 'no_remaining') {
        return new Response('This invoice has no remaining creditable value', { status: 409 });
      }
      if (!result.ok && result.kind === 'conflict') {
        return new Response('Credit note Draft could not be created', { status: 409 });
      }
      if (!result.ok && result.kind === 'invalid') {
        return renderCreditNoteForm(context, organization, invoice, values, result.issues);
      }
      if (!result.ok) return new Response('Credit note Draft could not be created', { status: 409 });

      context.session.flash('message', 'Credit note Draft created');
      return redirect(
        routes.app.invoices.creditNotes.edit.index.href({
          invoiceId: invoice.id,
          creditNoteId: result.creditNote.id,
        }),
      );
    },
  },
});
