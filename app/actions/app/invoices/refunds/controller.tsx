import { createController } from 'remix/router';
import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';
import type { RenderFunction } from 'remix/middleware/render';

import { findClient } from '../../../../data/clients.ts';
import type { Invoice, Organization, User } from '../../../../data/db.ts';
import { currencyMinorDigits } from '../../../../data/invoices/calculation.ts';
import { isValidIsoDate } from '../../../../data/invoices/dates.ts';
import { invoiceActivityData } from '../../../../data/invoices/payments.ts';
import {
  isInvoiceRefundMethod,
  parseRefundAmount,
  recordInvoiceRefund,
  voidInvoiceRefund,
} from '../../../../data/invoices/refunds.ts';
import type { InvoiceRefundMethod } from '../../../../data/invoices/refunds.ts';
import { findInvoice, findInvoiceLines } from '../../../../data/invoices/records.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { formText } from '../form-text.ts';
import { InvoiceShowPage } from '../show-page.tsx';
import type { InvoiceShowPageProps, RefundFormValues } from '../show-page.tsx';

type RefundRequestContext = RequestContext<AnyParams, ContextEntries> & {
  formData: FormData;
  render: RenderFunction;
};

type RefundPageErrors = Pick<
  InvoiceShowPageProps,
  'refundFormValues' | 'refundFieldErrors' | 'refundActionError' | 'voidRefundError'
>;

async function renderRefundError(
  context: RefundRequestContext,
  organization: Organization,
  invoice: Invoice,
  pageErrors: RefundPageErrors,
) {
  let auth = context.get(Auth) as GoodAuth<User>;
  let [lines, client, paymentData] = await Promise.all([
    findInvoiceLines(organization.id, invoice.id),
    findClient(organization.id, invoice.client_id),
    invoiceActivityData(organization.id, invoice),
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
      {...pageErrors}
    />,
    { status: 400 },
  );
}

export default createController(routes.app.invoices.refunds, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async record(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }

      let refundFormValues: RefundFormValues = {
        amount: formText(context, 'amount'),
        refund_date: formText(context, 'refund_date'),
        refund_method: formText(context, 'refund_method'),
        reference: formText(context, 'reference'),
      };
      if (invoice.status !== 'issued') {
        return renderRefundError(context, organization, invoice, {
          refundFormValues,
          refundActionError: 'Refunds can be recorded only for issued invoices.',
        });
      }

      let refundFieldErrors: NonNullable<InvoiceShowPageProps['refundFieldErrors']> = {};
      let amountMinor = parseRefundAmount(refundFormValues.amount, invoice.currency);
      if (amountMinor == null || amountMinor <= 0) {
        let digits = currencyMinorDigits(invoice.currency);
        let precision = digits === 0 ? 'whole currency units' : `at most ${digits} decimal places`;
        refundFieldErrors.amount = `Enter an amount greater than zero using ${precision}.`;
      }
      if (!isValidIsoDate(refundFormValues.refund_date)) {
        refundFieldErrors.refund_date = 'Enter a valid refund date.';
      }
      if (!isInvoiceRefundMethod(refundFormValues.refund_method)) {
        refundFieldErrors.refund_method = 'Choose a valid refund method.';
      }
      if (refundFormValues.reference.length > 200) {
        refundFieldErrors.reference = 'Reference must be 200 characters or fewer.';
      }
      if (Object.keys(refundFieldErrors).length > 0) {
        return renderRefundError(context, organization, invoice, {
          refundFormValues,
          refundFieldErrors,
        });
      }

      let result = await recordInvoiceRefund(organization.id, invoice.id, {
        refundDate: refundFormValues.refund_date,
        amountMinor: amountMinor!,
        method: refundFormValues.refund_method as InvoiceRefundMethod,
        reference: refundFormValues.reference.trim() || null,
      });
      if (!result.ok) {
        if (result.kind === 'not_found') return new Response('Invoice not found', { status: 404 });
        let refundActionError =
          result.kind === 'over_refund_due'
            ? 'Refund cannot exceed the current refund due amount.'
            : result.kind === 'no_refund_due'
              ? 'There is no refund due on this invoice.'
              : result.kind === 'not_issued'
                ? 'Refunds can be recorded only for issued invoices.'
                : 'Enter valid refund details.';
        return renderRefundError(context, organization, invoice, {
          refundFormValues,
          refundActionError,
        });
      }

      context.session.flash('message', 'Refund recorded');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
    async void(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }

      let reason = formText(context, 'reason');
      let voidRefundError = (
        message: string,
      ): NonNullable<InvoiceShowPageProps['voidRefundError']> => ({
        refundId: context.params.refundId,
        reason,
        message,
      });
      if (!reason.trim()) {
        return renderRefundError(context, organization, invoice, {
          voidRefundError: voidRefundError('Enter a reason for voiding this refund.'),
        });
      }
      if (reason.trim().length > 1000) {
        return renderRefundError(context, organization, invoice, {
          voidRefundError: voidRefundError('Reason must be 1,000 characters or fewer.'),
        });
      }

      let result = await voidInvoiceRefund(
        organization.id,
        invoice.id,
        context.params.refundId,
        reason,
      );
      if (!result.ok) {
        if (result.kind === 'not_found') return new Response('Refund not found', { status: 404 });
        if (result.kind === 'already_voided') {
          return new Response('This refund has already been voided', { status: 409 });
        }
        let error = voidRefundError(
          result.kind === 'not_issued'
            ? 'Refunds can be voided only on issued invoices.'
            : 'Enter a reason for voiding this refund.',
        );
        return renderRefundError(context, organization, invoice, { voidRefundError: error });
      }

      context.session.flash('message', 'Refund voided');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
