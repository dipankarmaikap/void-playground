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
import {
  invoiceActivityData,
  isInvoicePaymentMethod,
  parsePaymentAmount,
  recordInvoicePayment,
  voidInvoicePayment,
} from '../../../../data/invoices/payments.ts';
import type { InvoicePaymentMethod } from '../../../../data/invoices/payments.ts';
import { findInvoice, findInvoiceLines } from '../../../../data/invoices/records.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { isValidIsoDate } from '../../../../data/invoices/dates.ts';
import { routes } from '../../../../routes.ts';
import { formText } from '../form-text.ts';
import { InvoiceShowPage } from '../show-page.tsx';
import type { InvoiceShowPageProps, PaymentFormValues } from '../show-page.tsx';

type PaymentRequestContext = RequestContext<AnyParams, ContextEntries> & {
  formData: FormData;
  render: RenderFunction;
};

type PaymentPageErrors = Pick<
  InvoiceShowPageProps,
  'paymentFormValues' | 'paymentFieldErrors' | 'paymentActionError' | 'voidPaymentError'
>;

async function renderPaymentError(
  context: PaymentRequestContext,
  organization: Organization,
  invoice: Invoice,
  pageErrors: PaymentPageErrors,
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

export default createController(routes.app.invoices.payments, {
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

      let paymentFormValues: PaymentFormValues = {
        amount: formText(context, 'amount'),
        payment_date: formText(context, 'payment_date'),
        payment_method: formText(context, 'payment_method'),
        reference: formText(context, 'reference'),
      };
      if (invoice.status !== 'issued') {
        return renderPaymentError(context, organization, invoice, {
          paymentFormValues,
          paymentActionError: 'Payments can be recorded only for issued invoices.',
        });
      }

      let paymentFieldErrors: NonNullable<InvoiceShowPageProps['paymentFieldErrors']> = {};
      let amountMinor = parsePaymentAmount(paymentFormValues.amount, invoice.currency);
      if (amountMinor == null || amountMinor <= 0) {
        let digits = currencyMinorDigits(invoice.currency);
        let precision = digits === 0 ? 'whole currency units' : `at most ${digits} decimal places`;
        paymentFieldErrors.amount = `Enter an amount greater than zero using ${precision}.`;
      }
      if (!isValidIsoDate(paymentFormValues.payment_date)) {
        paymentFieldErrors.payment_date = 'Enter a valid payment date.';
      }
      if (!isInvoicePaymentMethod(paymentFormValues.payment_method)) {
        paymentFieldErrors.payment_method = 'Choose a valid payment method.';
      }
      if (paymentFormValues.reference.length > 200) {
        paymentFieldErrors.reference = 'Reference must be 200 characters or fewer.';
      }
      if (Object.keys(paymentFieldErrors).length > 0) {
        return renderPaymentError(context, organization, invoice, {
          paymentFormValues,
          paymentFieldErrors,
        });
      }

      let result = await recordInvoicePayment(organization.id, invoice.id, {
        paymentDate: paymentFormValues.payment_date,
        amountMinor: amountMinor!,
        method: paymentFormValues.payment_method as InvoicePaymentMethod,
        reference: paymentFormValues.reference.trim() || null,
      });
      if (!result.ok) {
        if (result.kind === 'not_found') return new Response('Invoice not found', { status: 404 });
        let paymentActionError =
          result.kind === 'over_balance'
            ? 'Payment cannot exceed the current balance due.'
            : result.kind === 'no_balance'
              ? 'There is no remaining balance due on this invoice.'
              : result.kind === 'not_issued'
                ? 'Payments can be recorded only for issued invoices.'
                : 'Enter valid payment details.';
        return renderPaymentError(context, organization, invoice, {
          paymentFormValues,
          paymentActionError,
        });
      }

      context.session.flash('message', 'Payment recorded');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
    async void(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice || invoice.document_type !== 'invoice') {
        return new Response('Invoice not found', { status: 404 });
      }

      let reason = formText(context, 'reason');
      let voidPaymentError = (
        message: string,
      ): NonNullable<InvoiceShowPageProps['voidPaymentError']> => ({
        paymentId: context.params.paymentId,
        reason,
        message,
      });
      if (!reason.trim()) {
        return renderPaymentError(context, organization, invoice, {
          voidPaymentError: voidPaymentError('Enter a reason for voiding this payment.'),
        });
      }
      if (reason.trim().length > 1000) {
        return renderPaymentError(context, organization, invoice, {
          voidPaymentError: voidPaymentError('Reason must be 1,000 characters or fewer.'),
        });
      }

      let result = await voidInvoicePayment(
        organization.id,
        invoice.id,
        context.params.paymentId,
        reason,
      );
      if (!result.ok) {
        if (result.kind === 'not_found') return new Response('Payment not found', { status: 404 });
        if (result.kind === 'already_voided') {
          return new Response('This payment has already been voided', { status: 409 });
        }
        let error = voidPaymentError(
          result.kind === 'not_issued'
            ? 'Payments can be voided only on issued invoices.'
            : result.kind === 'refunds_exceed_remaining_payments'
              ? 'This payment cannot be voided because active refunds would exceed the remaining active payments.'
              : 'Enter a reason for voiding this payment.',
        );
        return renderPaymentError(context, organization, invoice, { voidPaymentError: error });
      }

      context.session.flash('message', 'Payment voided');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
