import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { redirect } from 'remix/response/redirect';

import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import {
  createCreditNoteDraft,
  findCreditNote,
  findCreditNoteLines,
  findIssuedCreditNotePdfBytes,
  remainingCreditNoteLineCapacity,
  remainingCreditableValue,
  updateCreditNoteDraft,
} from '../../../../data/invoices/credit-notes.ts';
import type { CreditNoteDraftIssue } from '../../../../data/invoices/credit-notes.ts';
import {
  newCreditNoteFormValues,
  creditNoteFormValuesOf,
} from '../../../../data/invoices/credit-note-form-values.ts';
import type { CreditNoteFormValues } from '../../../../data/invoices/credit-note-form-values.ts';
import type { Invoice, Organization, User } from '../../../../data/db.ts';
import {
  renderCreditNotePdf,
  sellerFromInvoiceSnapshot,
} from '../../../../data/invoices/pdf.ts';
import { creditNotePdfFilename } from '../../../../data/invoices/credit-note-pdf-artifacts.ts';
import { findInvoice, findInvoiceLines } from '../../../../data/invoices/records.ts';
import { todayInKolkata } from '../../../../data/invoices/dates.ts';
import { authedUser, requireAuth } from '../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { parseCreditNoteFormValues } from './public/schema.ts';
import { CreditNoteDraftPage } from './form-page.tsx';

type CreditNoteRequestContext = RequestContext<AnyParams, ContextEntries> & {
  db: SqliteDatabase;
  formData: FormData;
  render: RenderFunction;
};

function identityOf(auth: GoodAuth<User>) {
  return { email: auth.identity.email, displayName: auth.identity.display_name };
}

async function renderNewForm(
  context: CreditNoteRequestContext,
  organization: Organization,
  invoice: Invoice,
  values: CreditNoteFormValues,
  issues: readonly CreditNoteDraftIssue[] = [],
) {
  let auth = authedUser(context);
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
      identity={identityOf(auth)}
      organizationName={organization.name}
      invoice={invoice}
      lines={lines}
      creditableQuantities={creditableQuantities}
      creditDate={todayInKolkata()}
      action={routes.app.invoices.creditNotes.create.href({ invoiceId: invoice.id })}
      heading="New credit note draft"
      submitLabel="Create credit note draft"
      values={values}
      issues={issues}
    />,
    issues.length > 0 ? { status: 400 } : undefined,
  );
}

async function renderEditForm(
  context: CreditNoteRequestContext,
  organization: Organization,
  invoice: Invoice,
  creditNoteId: string,
  values: CreditNoteFormValues,
  issues: readonly CreditNoteDraftIssue[] = [],
) {
  let auth = authedUser(context);
  let [lines, creditNote] = await Promise.all([
    findInvoiceLines(context.db, organization.id, invoice.id),
    findCreditNote(context.db, organization.id, invoice.id, creditNoteId),
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
      identity={identityOf(auth)}
      organizationName={organization.name}
      invoice={invoice}
      creditNote={creditNote ?? undefined}
      lines={lines}
      creditableQuantities={creditableQuantities}
      creditDate={todayInKolkata()}
      action={routes.app.invoices.creditNotes.update.href({
        invoiceId: invoice.id,
        creditNoteId,
      })}
      method="PUT"
      heading="Edit credit note draft"
      submitLabel="Save credit note draft"
      values={values}
      issues={issues}
    />,
    issues.length > 0 ? { status: 400 } : undefined,
  );
}

export default createController(routes.app.invoices.creditNotes, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async new(context) {
      let organization = context.get(CurrentOrganization);
      let auth = authedUser(context);
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
          identity={identityOf(auth)}
          organizationName={organization.name}
          invoice={invoice}
          lines={lines}
          creditableQuantities={creditableQuantities}
          creditDate={todayInKolkata()}
          action={routes.app.invoices.creditNotes.create.href({
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
    async create(context) {
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

      let values = parseCreditNoteFormValues(context.formData);
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
        return renderNewForm(context, organization, invoice, values, result.issues);
      }
      if (!result.ok) return new Response('Credit note Draft could not be created', { status: 409 });

      context.session.flash('message', 'Credit note Draft created');
      return redirect(
        routes.app.invoices.creditNotes.edit.href({
          invoiceId: invoice.id,
          creditNoteId: result.creditNote.id,
        }),
      );
    },
    async edit(context) {
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
      let auth = authedUser(context);
      let message = context.session.get('message');
      return context.render(
        <CreditNoteDraftPage
          csrfToken={getCsrfToken(context)}
          identity={identityOf(auth)}
          organizationName={organization.name}
          invoice={invoice}
          creditNote={creditNote}
          lines={sourceLines}
          creditableQuantities={creditableQuantities}
          creditDate={todayInKolkata()}
          action={routes.app.invoices.creditNotes.update.href({
            invoiceId: invoice.id,
            creditNoteId: creditNote.id,
          })}
          method="PUT"
          heading="Edit credit note draft"
          submitLabel="Save credit note draft"
          values={creditNoteFormValuesOf(creditNote, sourceLines, savedLines)}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async update(context) {
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
        return renderEditForm(
          context,
          organization,
          invoice,
          context.params.creditNoteId,
          values,
          result.issues,
        );
      }
      if (!result.ok) return new Response('Credit note Draft could not be updated', { status: 409 });

      context.session.flash('message', 'Credit note Draft updated');
      return redirect(
        routes.app.invoices.creditNotes.edit.href({
          invoiceId: invoice.id,
          creditNoteId: result.creditNote.id,
        }),
      );
    },
    async pdf(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }
      let creditNote = await findCreditNote(
        context.db,
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
          context.db,
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
      let lines = await findCreditNoteLines(context.db, organization.id, invoice.id, creditNote.id);
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
