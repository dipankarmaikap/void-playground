import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import type {
  Client,
  CreditNote,
  Invoice,
  InvoiceLine,
  InvoicePayment,
  InvoiceRefund,
} from '../../../data/db.ts';
import { joinAddressParts } from '../../../data/address.ts';
import { countryName } from '../../../data/client-billing.ts';
import { clientTaxTypeLabel } from '../../../data/client-tax.ts';
import {
  currencyMinorDigits,
  formatMinorInput,
  formatMoney,
  formatMoneySigned,
} from '../../../data/invoices/calculation.ts';
import {
  groupedInvoiceTaxes,
  invoiceLineGstComponents,
} from '../../../data/invoices/tax.ts';
import { DRAFT_STATUS_LABEL } from '../../../data/invoices/records.ts';
import {
  INVOICE_PAYMENT_METHODS,
  invoicePaymentMethodLabel,
} from '../../../data/invoices/payments.ts';
import { INVOICE_REFUND_METHODS, refundMethodLabel } from '../../../data/invoices/refunds.ts';
import type { InvoiceDisplayStatus } from '../../../data/invoices/issuance.ts';
import { invoiceDisplayStatus } from '../../../data/invoices/issuance.ts';
import { todayInKolkata } from '../../../data/invoices/dates.ts';
import { PAYMENT_TERM_LABELS } from '../../../data/organization-invoicing.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { Input } from '../../../ui/input.tsx';
import {
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../ui/page-styles.ts';
import { Select } from '../../../ui/select.tsx';
import { colors, radius } from '../../../ui/theme.ts';

export interface PaymentFormValues {
  amount: string;
  payment_date: string;
  payment_method: string;
  reference: string;
}

export interface RefundFormValues {
  amount: string;
  refund_date: string;
  refund_method: string;
  reference: string;
}

export interface InvoiceShowPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  invoice: Invoice;
  lines: InvoiceLine[];
  client: Client | null;
  payments: InvoicePayment[];
  amountPaidMinor: number;
  refunds: InvoiceRefund[];
  activeRefundedMinor: number;
  netPaidMinor: number;
  refundDueMinor: number;
  creditNotes: CreditNote[];
  creditedTotalMinor: number;
  revisedTotalMinor: number;
  balanceDueMinor: number;
  message?: string;
  validationErrors?: readonly string[];
  internalNoteValue?: string;
  internalNoteError?: string;
  paymentFormValues?: PaymentFormValues;
  paymentFieldErrors?: Partial<Record<keyof PaymentFormValues, string>>;
  paymentActionError?: string;
  voidPaymentError?: {
    paymentId: string;
    reason: string;
    message: string;
  };
  refundFormValues?: RefundFormValues;
  refundFieldErrors?: Partial<Record<keyof RefundFormValues, string>>;
  refundActionError?: string;
  voidRefundError?: {
    refundId: string;
    reason: string;
    message: string;
  };
}

const cardStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
});

const headingStyle = css({ margin: 0, fontSize: '1.0625rem' });

const detailStyle = css({ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 });

const tableStyle = css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' });
const cellStyle = css({
  padding: '0.5rem 0.625rem',
  borderBottom: `1px solid ${colors.border}`,
  textAlign: 'left',
});
const amountCellStyle = css({ padding: '0.5rem 0.625rem', textAlign: 'right' });
const breakdownStyle = css({ margin: 0, fontSize: '0.9375rem', lineHeight: 1.6 });
const totalStyle = css({ margin: 0, textAlign: 'right', fontSize: '1.0625rem', fontWeight: 700 });
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' });
const paymentHistoryStyle = css({ display: 'grid', gap: '0.75rem', margin: 0, padding: 0, listStyle: 'none' });
const paymentEntryStyle = css({
  display: 'grid',
  gap: '0.5rem',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
});
const creditNoteHistoryStyle = css({
  display: 'grid',
  gap: '0.75rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
const creditNoteEntryStyle = css({
  display: 'grid',
  gap: '0.5rem',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
});
const paymentFormStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
  alignItems: 'end',
  gap: '0.75rem',
});
const paymentSubmitStyle = css({ alignSelf: 'end' });
const errorStyle = css({
  margin: 0,
  padding: '1rem',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.danger,
});
const textAreaStyle = css({
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '7rem',
  padding: '0.75rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: 'max(1rem, 1em)',
});
const noteFieldStyle = css({ display: 'grid', gap: '0.375rem', marginBottom: '0.75rem' });
const snapshotImageStyle = css({ display: 'block', maxWidth: '12rem', maxHeight: '8rem' });

function invoiceStatusLabel(status: InvoiceDisplayStatus): string {
  if (status === 'partially_paid') return 'Partially Paid';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function paymentStep(currency: string): string {
  let digits = currencyMinorDigits(currency);
  return digits === 0 ? '1' : `0.${'0'.repeat(digits - 1)}1`;
}

const refundStep = paymentStep;

export function InvoiceShowPage(handle: Handle<InvoiceShowPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      invoice,
      lines,
      client,
      payments,
      amountPaidMinor,
      refunds,
      activeRefundedMinor,
      netPaidMinor,
      refundDueMinor,
      creditNotes,
      creditedTotalMinor,
      revisedTotalMinor,
      balanceDueMinor,
      message,
      validationErrors = [],
      internalNoteValue,
      internalNoteError,
      paymentFormValues,
      paymentFieldErrors = {},
      paymentActionError,
      voidPaymentError,
      refundFormValues,
      refundFieldErrors = {},
      refundActionError,
      voidRefundError,
    } = handle.props;
    let taxSummary = groupedInvoiceTaxes(lines, invoice.currency);
    let displayStatus = invoiceDisplayStatus(
      invoice,
      netPaidMinor,
      todayInKolkata(),
      creditedTotalMinor,
    );
    let isDraft = invoice.status === 'draft';
    let isInvoice = invoice.document_type === 'invoice';
    let statusLabel = invoiceStatusLabel(displayStatus);
    let recipientAddress = joinAddressParts([
      invoice.recipient_billing_line1,
      invoice.recipient_billing_locality,
      invoice.recipient_billing_region,
      invoice.recipient_billing_postal_code,
    ]);
    let sellerAddress = joinAddressParts([
      invoice.seller_address_line1,
      invoice.seller_address_locality,
      invoice.seller_address_region,
      invoice.seller_address_postal_code,
    ]);
    let pageTitle = isDraft ? 'Invoice draft' : `${statusLabel} invoice`;
    let amountError = paymentFieldErrors.amount;
    let dateError = paymentFieldErrors.payment_date;
    let methodError = paymentFieldErrors.payment_method;
    let referenceError = paymentFieldErrors.reference;
    let amountDescriptionId = amountError
      ? 'invoice-payment-amount-error'
      : paymentActionError
        ? 'invoice-payment-action-error'
        : undefined;
    let refundAmountError = refundFieldErrors.amount;
    let refundDateError = refundFieldErrors.refund_date;
    let refundMethodError = refundFieldErrors.refund_method;
    let refundReferenceError = refundFieldErrors.reference;
    let refundAmountDescriptionId = refundAmountError
      ? 'invoice-refund-amount-error'
      : refundActionError
        ? 'invoice-refund-action-error'
        : undefined;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title={pageTitle}
        description={`${isDraft ? 'Draft' : statusLabel} invoice for ${invoice.recipient_legal_name}.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>{pageTitle}</h1>
          <p mix={pageIntroStyle}>
            Status: {isDraft ? DRAFT_STATUS_LABEL : statusLabel}.
            {isDraft
              ? ' Drafts have no final invoice number and can be edited or discarded.'
              : ' Client-facing invoice details are locked after issue.'}
          </p>
        </header>
        <div mix={actionsStyle}>
          <a
            href={routes.app.invoices.pdf.href({ invoiceId: invoice.id })}
            download
            mix={linkButtonStyle}
          >
            Download PDF
          </a>
        </div>
        {message ? (
          <p role="status" mix={[noticeStatusStyle, noticeSpacingStyle]}>
            {message}
          </p>
        ) : null}
        {validationErrors.length > 0 ? (
          <div role="alert" mix={errorStyle}>
            <p>Please complete these requirements before issuing the invoice:</p>
            <ul>
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {paymentActionError ? (
          <p id="invoice-payment-action-error" role="alert" mix={errorStyle}>
            {paymentActionError}
          </p>
        ) : null}
        {refundActionError ? (
          <p id="invoice-refund-action-error" role="alert" mix={errorStyle}>
            {refundActionError}
          </p>
        ) : null}
        <div mix={cardStyle}>
          <h2 mix={headingStyle}>{isDraft ? 'Draft details' : 'Issued invoice details'}</h2>
          {invoice.invoice_number ? (
            <p mix={detailStyle}>Invoice number: {invoice.invoice_number}</p>
          ) : null}
          <p mix={detailStyle}>Recipient: {invoice.recipient_legal_name}</p>
          {isDraft ? (
            <p mix={detailStyle}>
              Client: {client?.legal_name ?? 'Client record unavailable'}
              {client?.status === 'archived' ? ' (Archived)' : ''}
            </p>
          ) : null}
          <p mix={detailStyle}>Currency: {invoice.currency}</p>
          <p mix={detailStyle}>Invoice date: {invoice.invoice_date}</p>
          <p mix={detailStyle}>Due date: {invoice.due_date}</p>
          <p mix={detailStyle}>
            Payment term: {PAYMENT_TERM_LABELS[invoice.payment_term as keyof typeof PAYMENT_TERM_LABELS] ?? invoice.payment_term}
          </p>
          {invoice.custom_payment_terms ? (
            <p mix={detailStyle}>Custom terms: {invoice.custom_payment_terms}</p>
          ) : null}
          {recipientAddress ? (
            <p mix={detailStyle}>Billing address: {recipientAddress}</p>
          ) : null}
          {invoice.recipient_billing_country ? (
            <p mix={detailStyle}>Country: {countryName(invoice.recipient_billing_country)}</p>
          ) : null}
          {invoice.recipient_tax_value ? (
            <p mix={detailStyle}>
              Tax identifier: {clientTaxTypeLabel(invoice.recipient_tax_type)} {invoice.recipient_tax_value}
            </p>
          ) : null}
          {invoice.recipient_tax_state_name ? (
            <p mix={detailStyle}>Tax State/UT: {invoice.recipient_tax_state_name}</p>
          ) : null}
          {invoice.gst_mode === 'india_gst' ? (
            <>
              <p mix={detailStyle}>
                Place of Supply:{' '}
                {invoice.supply_type === 'domestic'
                  ? invoice.place_of_supply_state_name ?? '—'
                  : countryName(invoice.place_of_supply_country) || '—'}
              </p>
              <p mix={detailStyle}>
                Recipient GSTIN applicable: {invoice.recipient_gstin_applicable ? 'Yes' : 'No'}
              </p>
              {invoice.supply_type === 'export_lut' ? (
                <p mix={detailStyle}>
                  Export endorsement: Export under LUT/Bond without payment of IGST.
                </p>
              ) : invoice.supply_type === 'export_igst' ? (
                <p mix={detailStyle}>Export endorsement: Export with IGST.</p>
              ) : null}
              {invoice.export_reference ? (
                <p mix={detailStyle}>Export reference: {invoice.export_reference}</p>
              ) : null}
              {invoice.reverse_charge ? (
                <p mix={detailStyle}>
                  Reverse charge applies. GST shown below is payable by recipient and is excluded
                  from the amount collected by the supplier.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {!isDraft ? (
          <div mix={cardStyle}>
            <h2 mix={headingStyle}>Seller snapshot</h2>
            <p mix={detailStyle}>Legal name: {invoice.seller_legal_name}</p>
            <p mix={detailStyle}>Business address: {sellerAddress}</p>
            <p mix={detailStyle}>Country: {countryName(invoice.seller_country)}</p>
            {invoice.seller_email ? <p mix={detailStyle}>Email: {invoice.seller_email}</p> : null}
            {invoice.seller_phone ? <p mix={detailStyle}>Phone: {invoice.seller_phone}</p> : null}
            {invoice.seller_pan ? <p mix={detailStyle}>PAN: {invoice.seller_pan}</p> : null}
            {invoice.seller_gst_registered ? (
              <>
                <p mix={detailStyle}>GSTIN: {invoice.seller_gstin}</p>
                <p mix={detailStyle}>
                  GST State/UT: {invoice.seller_gst_state_name} ({invoice.seller_gst_state_code})
                </p>
              </>
            ) : null}
            {invoice.seller_logo_data_url ? (
              <img
                src={invoice.seller_logo_data_url}
                alt={`${invoice.seller_legal_name} logo`}
                mix={snapshotImageStyle}
              />
            ) : null}
            {invoice.seller_signature_data_url ? (
              <img
                src={invoice.seller_signature_data_url}
                alt={`Authorized signature for ${invoice.seller_signatory_name ?? invoice.seller_legal_name}`}
                mix={snapshotImageStyle}
              />
            ) : null}
            {invoice.seller_signatory_name ? (
              <p mix={detailStyle}>
                Authorized signatory: {invoice.seller_signatory_name}
                {invoice.seller_signatory_designation
                  ? ` · ${invoice.seller_signatory_designation}`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}

        <div mix={cardStyle}>
          <h2 mix={headingStyle}>Service lines</h2>
          <table mix={tableStyle}>
            <thead>
              <tr>
                <th mix={cellStyle}>Description</th>
                <th mix={cellStyle}>SAC</th>
                <th mix={cellStyle}>Quantity</th>
                <th mix={cellStyle}>Unit price</th>
                <th mix={amountCellStyle}>Amount</th>
                <th mix={amountCellStyle}>Line discount</th>
                <th mix={amountCellStyle}>Net</th>
                <th mix={cellStyle}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td mix={cellStyle}>{line.description}</td>
                  <td mix={cellStyle}>{line.sac ?? '—'}</td>
                  <td mix={cellStyle}>{line.quantity}</td>
                  <td mix={cellStyle}>{line.unit_price}</td>
                  <td mix={amountCellStyle}>
                    {formatMoney(BigInt(line.amount_minor), invoice.currency)}
                  </td>
                  <td mix={amountCellStyle}>
                    {line.line_discount_minor === 0
                      ? '—'
                      : `${line.discount_mode === 'percent' ? `${line.discount_value}% · ` : ''}${formatMoney(BigInt(line.line_discount_minor), invoice.currency)}`}
                  </td>
                  <td mix={amountCellStyle}>
                    {formatMoney(BigInt(line.net_minor), invoice.currency)}
                  </td>
                  <td mix={cellStyle}>
                    {[
                      ...invoiceLineGstComponents(line, invoice.currency),
                      line.foreign_tax_mode && line.foreign_tax_label
                        ? `${line.foreign_tax_label}${line.foreign_tax_mode === 'percent' ? ` @ ${line.foreign_tax_rate}%` : ''} ${formatMoney(BigInt(line.foreign_tax_amount_minor), invoice.currency)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || (line.tax_treatment ? `${line.tax_treatment.replace('_', '-')}: 0%` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div mix={cardStyle}>
          <h2 mix={headingStyle}>Amount breakdown</h2>
          <p mix={breakdownStyle}>
            Subtotal: {formatMoney(BigInt(invoice.subtotal_minor), invoice.currency)}
          </p>
          <p mix={breakdownStyle}>
            Line discounts: {formatMoney(BigInt(invoice.line_discount_total_minor), invoice.currency)}
          </p>
          <p mix={breakdownStyle}>
            Invoice discount ({invoice.invoice_discount_mode ?? 'none'}):{' '}
            {formatMoney(BigInt(invoice.invoice_discount_minor), invoice.currency)}
          </p>
          <p mix={breakdownStyle}>
            Net taxable subtotal: {formatMoney(BigInt(invoice.net_subtotal_minor), invoice.currency)}
          </p>
          {invoice.gst_mode === 'india_gst' || invoice.gst_mode === 'foreign_manual' ? (
            <>
              <h3 mix={headingStyle}>
                {invoice.reverse_charge ? 'GST disclosure (payable by recipient)' : 'Grouped tax summary'}
              </h3>
              {taxSummary.length > 0 ? (
                taxSummary.map((tax) => (
                  <p key={tax.label} mix={breakdownStyle}>
                    {tax.label}: {tax.formattedAmount}
                  </p>
                ))
              ) : (
                <p mix={breakdownStyle}>
                  {invoice.gst_mode === 'foreign_manual' ? 'No manual foreign tax.' : 'No GST charged.'}
                </p>
              )}
              <p mix={breakdownStyle}>
                {invoice.reverse_charge ? 'Tax payable by recipient: ' : 'Total tax: '}
                {formatMoney(BigInt(invoice.tax_total_minor), invoice.currency)}
              </p>
            </>
          ) : null}
          <p mix={breakdownStyle}>
            Round-off: {formatMoneySigned(BigInt(invoice.round_off_minor), invoice.currency)}
          </p>
          <p mix={totalStyle}>Total: {formatMoney(BigInt(invoice.total_minor), invoice.currency)}</p>
        </div>

        {!isDraft && isInvoice ? (
          <div mix={cardStyle}>
            <h2 mix={headingStyle}>Payments</h2>
            <p mix={detailStyle}>
              Amount paid: {formatMoney(BigInt(amountPaidMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Credited amount: {formatMoney(BigInt(creditedTotalMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Revised total: {formatMoney(BigInt(revisedTotalMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Balance due: {formatMoney(BigInt(balanceDueMinor), invoice.currency)}
            </p>
            {refundDueMinor > 0 ? (
              <p mix={detailStyle}>
                Refund due: {formatMoney(BigInt(refundDueMinor), invoice.currency)}
              </p>
            ) : null}
            {payments.length > 0 ? (
              <ol role="list" mix={paymentHistoryStyle}>
                {payments.map((payment) => {
                  let voidError =
                    voidPaymentError?.paymentId === payment.id ? voidPaymentError : undefined;
                  let voidReasonId = `invoice-payment-${payment.id}-void-reason`;
                  let voidErrorId = `${voidReasonId}-error`;
                  let voidAction = routes.app.invoices.payments.void.href({
                    invoiceId: invoice.id,
                    paymentId: payment.id,
                  });
                  return (
                    <li key={payment.id} mix={paymentEntryStyle}>
                      <h3 id={`invoice-payment-${payment.id}-heading`} mix={headingStyle}>
                        {invoicePaymentMethodLabel(payment.payment_method)} · {payment.payment_date}
                      </h3>
                      <p mix={detailStyle}>
                        Amount: {formatMoney(BigInt(payment.amount_minor), invoice.currency)}
                      </p>
                      {payment.reference ? (
                        <p mix={detailStyle}>Reference: {payment.reference}</p>
                      ) : null}
                      {payment.voided_at !== null ? (
                        <>
                          <p mix={detailStyle}>
                            Voided on:{' '}
                            <time dateTime={new Date(payment.voided_at).toISOString()}>
                              {new Date(payment.voided_at).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}{' '}
                              IST
                            </time>
                          </p>
                          <p mix={detailStyle}>Void reason: {payment.void_reason}</p>
                        </>
                      ) : (
                        <form
                          method="post"
                          action={voidAction}
                          aria-labelledby={`invoice-payment-${payment.id}-heading`}
                        >
                          <input type="hidden" name="_csrf" value={csrfToken} />
                          <label htmlFor={voidReasonId}>Reason for voiding this payment</label>
                          <textarea
                            id={voidReasonId}
                            name="reason"
                            required
                            maxLength={1000}
                            autoFocus={Boolean(voidError)}
                            defaultValue={voidError?.reason ?? ''}
                            aria-invalid={voidError ? true : undefined}
                            aria-describedby={voidError ? voidErrorId : undefined}
                            mix={textAreaStyle}
                          />
                          {voidError ? (
                            <p id={voidErrorId} role="alert" mix={errorStyle}>
                              {voidError.message}
                            </p>
                          ) : null}
                          <Button type="submit" variant="danger">
                            Void payment
                          </Button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p mix={detailStyle}>No payments recorded.</p>
            )}
            {balanceDueMinor > 0 ? (
              <>
                <h3 id="record-invoice-payment-heading" mix={headingStyle}>
                  Record a payment
                </h3>
                <form
                  method="post"
                  action={routes.app.invoices.payments.record.href({ invoiceId: invoice.id })}
                  aria-labelledby="record-invoice-payment-heading"
                  mix={paymentFormStyle}
                >
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <Field
                    label={`Amount received (${invoice.currency})`}
                    error={amountError}
                    errorId={amountError ? 'invoice-payment-amount-error' : undefined}
                  >
                    <Input
                      id="invoice-payment-amount"
                      name="amount"
                      type="number"
                      min={paymentStep(invoice.currency)}
                      max={formatMinorInput(BigInt(balanceDueMinor), invoice.currency)}
                      step={paymentStep(invoice.currency)}
                      required
                      autoFocus={Boolean(amountError || paymentActionError)}
                      defaultValue={paymentFormValues?.amount ?? ''}
                      aria-invalid={amountDescriptionId ? true : undefined}
                      aria-describedby={amountDescriptionId}
                    />
                  </Field>
                  <Field
                    label="Payment date"
                    error={dateError}
                    errorId={dateError ? 'invoice-payment-date-error' : undefined}
                  >
                    <Input
                      id="invoice-payment-date"
                      name="payment_date"
                      type="date"
                      required
                      autoFocus={Boolean(!amountError && dateError)}
                      defaultValue={paymentFormValues?.payment_date ?? todayInKolkata()}
                      aria-invalid={dateError ? true : undefined}
                      aria-describedby={dateError ? 'invoice-payment-date-error' : undefined}
                    />
                  </Field>
                  <Field
                    label="Payment method"
                    error={methodError}
                    errorId={methodError ? 'invoice-payment-method-error' : undefined}
                  >
                    <Select
                      id="invoice-payment-method"
                      name="payment_method"
                      required
                      autoFocus={Boolean(
                        !amountError && !dateError && methodError,
                      )}
                      aria-invalid={methodError ? true : undefined}
                      aria-describedby={methodError ? 'invoice-payment-method-error' : undefined}
                    >
                      <option value="" selected={!paymentFormValues?.payment_method}>
                        Choose a payment method
                      </option>
                      {INVOICE_PAYMENT_METHODS.map((method) => (
                        <option
                          key={method.value}
                          value={method.value}
                          selected={paymentFormValues?.payment_method === method.value}
                        >
                          {method.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Reference (optional)"
                    error={referenceError}
                    errorId={referenceError ? 'invoice-payment-reference-error' : undefined}
                  >
                    <Input
                      id="invoice-payment-reference"
                      name="reference"
                      maxLength={200}
                      autoFocus={Boolean(
                        !amountError && !dateError && !methodError && referenceError,
                      )}
                      defaultValue={paymentFormValues?.reference ?? ''}
                      aria-invalid={referenceError ? true : undefined}
                      aria-describedby={
                        referenceError ? 'invoice-payment-reference-error' : undefined
                      }
                    />
                  </Field>
                  <div mix={paymentSubmitStyle}>
                    <Button type="submit">Record payment</Button>
                  </div>
                </form>
              </>
            ) : null}
          </div>
        ) : null}

        {!isDraft && isInvoice ? (
          <section aria-labelledby="invoice-refunds-heading" mix={cardStyle}>
            <h2 id="invoice-refunds-heading" mix={headingStyle}>
              Refunds
            </h2>
            <p mix={detailStyle}>
              Refunded: {formatMoney(BigInt(activeRefundedMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Net paid: {formatMoneySigned(BigInt(netPaidMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Refund due: {formatMoney(BigInt(refundDueMinor), invoice.currency)}
            </p>
            {refunds.length > 0 ? (
              <ol role="list" mix={paymentHistoryStyle}>
                {refunds.map((refund) => {
                  let voidError =
                    voidRefundError?.refundId === refund.id ? voidRefundError : undefined;
                  let voidReasonId = `invoice-refund-${refund.id}-void-reason`;
                  let voidErrorId = `${voidReasonId}-error`;
                  return (
                    <li key={refund.id} mix={paymentEntryStyle}>
                      <h3 id={`invoice-refund-${refund.id}-heading`} mix={headingStyle}>
                        {refundMethodLabel(refund.refund_method)} · {refund.refund_date}
                      </h3>
                      <p mix={detailStyle}>
                        Amount: {formatMoney(BigInt(refund.amount_minor), invoice.currency)}
                      </p>
                      {refund.reference ? (
                        <p mix={detailStyle}>Reference: {refund.reference}</p>
                      ) : null}
                      {refund.voided_at !== null ? (
                        <>
                          <p mix={detailStyle}>
                            Voided on:{' '}
                            <time dateTime={new Date(refund.voided_at).toISOString()}>
                              {new Date(refund.voided_at).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}{' '}
                              IST
                            </time>
                          </p>
                          <p mix={detailStyle}>Void reason: {refund.void_reason}</p>
                        </>
                      ) : (
                        <form
                          method="post"
                          action={routes.app.invoices.refunds.void.href({
                            invoiceId: invoice.id,
                            refundId: refund.id,
                          })}
                          aria-labelledby={`invoice-refund-${refund.id}-heading`}
                        >
                          <input type="hidden" name="_csrf" value={csrfToken} />
                          <label htmlFor={voidReasonId}>Reason for voiding this refund</label>
                          <textarea
                            id={voidReasonId}
                            name="reason"
                            required
                            maxLength={1000}
                            autoFocus={Boolean(voidError)}
                            defaultValue={voidError?.reason ?? ''}
                            aria-invalid={voidError ? true : undefined}
                            aria-describedby={voidError ? voidErrorId : undefined}
                            mix={textAreaStyle}
                          />
                          {voidError ? (
                            <p id={voidErrorId} role="alert" mix={errorStyle}>
                              {voidError.message}
                            </p>
                          ) : null}
                          <Button type="submit" variant="danger">
                            Void refund
                          </Button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p mix={detailStyle}>No refunds recorded.</p>
            )}
            {refundDueMinor > 0 ? (
              <>
                <h3 id="record-invoice-refund-heading" mix={headingStyle}>
                  Record refund
                </h3>
                <form
                  method="post"
                  action={routes.app.invoices.refunds.record.href({ invoiceId: invoice.id })}
                  aria-labelledby="record-invoice-refund-heading"
                  mix={paymentFormStyle}
                >
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <Field
                    label={`Refund amount (${invoice.currency})`}
                    error={refundAmountError}
                    errorId={refundAmountError ? 'invoice-refund-amount-error' : undefined}
                  >
                    <Input
                      id="invoice-refund-amount"
                      name="amount"
                      type="number"
                      min={refundStep(invoice.currency)}
                      max={formatMinorInput(BigInt(refundDueMinor), invoice.currency)}
                      step={refundStep(invoice.currency)}
                      required
                      autoFocus={Boolean(refundAmountError || refundActionError)}
                      defaultValue={refundFormValues?.amount ?? ''}
                      aria-invalid={refundAmountDescriptionId ? true : undefined}
                      aria-describedby={refundAmountDescriptionId}
                    />
                  </Field>
                  <Field
                    label="Refund date"
                    error={refundDateError}
                    errorId={refundDateError ? 'invoice-refund-date-error' : undefined}
                  >
                    <Input
                      id="invoice-refund-date"
                      name="refund_date"
                      type="date"
                      required
                      autoFocus={Boolean(!refundAmountError && refundDateError)}
                      defaultValue={refundFormValues?.refund_date ?? todayInKolkata()}
                      aria-invalid={refundDateError ? true : undefined}
                      aria-describedby={refundDateError ? 'invoice-refund-date-error' : undefined}
                    />
                  </Field>
                  <Field
                    label="Refund method"
                    error={refundMethodError}
                    errorId={refundMethodError ? 'invoice-refund-method-error' : undefined}
                  >
                    <Select
                      id="invoice-refund-method"
                      name="refund_method"
                      required
                      autoFocus={Boolean(!refundAmountError && !refundDateError && refundMethodError)}
                      aria-invalid={refundMethodError ? true : undefined}
                      aria-describedby={refundMethodError ? 'invoice-refund-method-error' : undefined}
                    >
                      <option value="" selected={!refundFormValues?.refund_method}>
                        Choose a refund method
                      </option>
                      {INVOICE_REFUND_METHODS.map((method) => (
                        <option
                          key={method.value}
                          value={method.value}
                          selected={refundFormValues?.refund_method === method.value}
                        >
                          {method.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Reference (optional)"
                    error={refundReferenceError}
                    errorId={refundReferenceError ? 'invoice-refund-reference-error' : undefined}
                  >
                    <Input
                      id="invoice-refund-reference"
                      name="reference"
                      maxLength={200}
                      autoFocus={Boolean(
                        !refundAmountError &&
                          !refundDateError &&
                          !refundMethodError &&
                          refundReferenceError,
                      )}
                      defaultValue={refundFormValues?.reference ?? ''}
                      aria-invalid={refundReferenceError ? true : undefined}
                      aria-describedby={
                        refundReferenceError ? 'invoice-refund-reference-error' : undefined
                      }
                    />
                  </Field>
                  <div mix={paymentSubmitStyle}>
                    <Button type="submit">Record refund</Button>
                  </div>
                </form>
              </>
            ) : null}
          </section>
        ) : null}

        {!isDraft && isInvoice ? (
          <section aria-labelledby="invoice-credit-notes-heading" mix={cardStyle}>
            <h2 id="invoice-credit-notes-heading" mix={headingStyle}>
              Credit notes
            </h2>
            <p mix={detailStyle}>
              Credited amount: {formatMoney(BigInt(creditedTotalMinor), invoice.currency)}
            </p>
            <p mix={detailStyle}>
              Revised total: {formatMoney(BigInt(revisedTotalMinor), invoice.currency)}
            </p>
            {creditNotes.length > 0 ? (
              <ol role="list" mix={creditNoteHistoryStyle}>
                {creditNotes.map((creditNote) => {
                  let draft = creditNote.status === 'draft';
                  return (
                    <li key={creditNote.id} mix={creditNoteEntryStyle}>
                      <h3 mix={headingStyle}>
                        {draft ? 'Credit note Draft' : `Credit note ${creditNote.credit_note_number}`}
                      </h3>
                      <p mix={detailStyle}>Credit note date: {creditNote.credit_date}</p>
                      <p mix={detailStyle}>Reason: {creditNote.reason}</p>
                      <p mix={detailStyle}>
                        Amount: {formatMoney(BigInt(creditNote.total_minor), invoice.currency)}
                      </p>
                      <div mix={actionsStyle}>
                        {draft ? (
                          <>
                            <a
                              href={routes.app.invoices.creditNotes.edit.index.href({
                                invoiceId: invoice.id,
                                creditNoteId: creditNote.id,
                              })}
                              mix={linkButtonStyle}
                            >
                              Edit credit note draft
                            </a>
                            <a
                              href={routes.app.invoices.creditNotes.pdf.href({
                                invoiceId: invoice.id,
                                creditNoteId: creditNote.id,
                              })}
                              download
                              mix={linkButtonStyle}
                            >
                              Preview Draft PDF
                            </a>
                            <form
                              method="post"
                              action={routes.app.invoices.creditNotes.lifecycle.discard.href({
                                invoiceId: invoice.id,
                                creditNoteId: creditNote.id,
                              })}
                              aria-label={`Discard credit note draft ${creditNote.id}`}
                            >
                              <input type="hidden" name="_csrf" value={csrfToken} />
                              <Button type="submit" variant="danger">
                                Discard draft
                              </Button>
                            </form>
                          </>
                        ) : (
                          <a
                            href={routes.app.invoices.creditNotes.pdf.href({
                              invoiceId: invoice.id,
                              creditNoteId: creditNote.id,
                            })}
                            download
                            mix={linkButtonStyle}
                          >
                            Download Credit Note PDF
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p mix={detailStyle}>No credit notes recorded.</p>
            )}
            {revisedTotalMinor > 0 ? (
              <a
                href={routes.app.invoices.creditNotes.new.index.href({
                  invoiceId: invoice.id,
                })}
                mix={linkButtonStyle}
              >
                Create credit note
              </a>
            ) : null}
          </section>
        ) : null}

        <div mix={cardStyle}>
          <h2 mix={headingStyle}>Notes</h2>
          <p mix={detailStyle}>Payment instructions: {invoice.payment_instructions ?? '—'}</p>
          <p mix={detailStyle}>Customer notes: {invoice.customer_notes ?? '—'}</p>
          {isDraft ? (
            <p mix={detailStyle}>Internal note (private): {invoice.internal_note ?? '—'}</p>
          ) : (
            <>
              <h3 id="internal-note-heading" mix={headingStyle}>
                Private internal note
              </h3>
              <form
                method="post"
                action={routes.app.invoices.lifecycle.internalNote.href({ invoiceId: invoice.id })}
                aria-labelledby="internal-note-heading"
              >
                <input type="hidden" name="_csrf" value={csrfToken} />
                <div mix={noteFieldStyle}>
                  <label htmlFor="invoice-internal-note">Internal note</label>
                  <textarea
                    id="invoice-internal-note"
                    name="internal_note"
                    maxLength={1000}
                    mix={textAreaStyle}
                    defaultValue={internalNoteValue ?? invoice.internal_note ?? ''}
                    aria-invalid={internalNoteError ? true : undefined}
                    aria-describedby={internalNoteError ? 'internal-note-error' : undefined}
                  />
                  {internalNoteError ? (
                    <p id="internal-note-error" role="alert">
                      {internalNoteError}
                    </p>
                  ) : null}
                </div>
                <Button type="submit">Save internal note</Button>
              </form>
            </>
          )}
        </div>

        {isDraft ? (
          <>
            <div mix={actionsStyle}>
              <a
                href={routes.app.invoices.edit.index.href({ invoiceId: invoice.id })}
                mix={linkButtonStyle}
              >
                Edit draft
              </a>
              <details>
                <summary>Discard draft</summary>
                <div>
                  <p>
                    Discarding this Draft permanently removes it and its service lines. This cannot
                    be undone.
                  </p>
                  <form
                    method="post"
                    action={routes.app.invoices.lifecycle.discard.href({ invoiceId: invoice.id })}
                    aria-label="Discard invoice draft"
                  >
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <Button type="submit" variant="danger">
                      Confirm discard draft
                    </Button>
                  </form>
                </div>
              </details>
            </div>
            <div mix={cardStyle}>
              <h2 id="issue-invoice-heading" mix={headingStyle}>
                Issue invoice
              </h2>
              <p mix={detailStyle}>
                Issuing assigns the financial-year invoice number and locks client-facing details.
              </p>
              <form
                method="post"
                action={routes.app.invoices.lifecycle.issue.href({ invoiceId: invoice.id })}
                aria-labelledby="issue-invoice-heading"
              >
                <input type="hidden" name="_csrf" value={csrfToken} />
                <Button type="submit">Mark as sent</Button>
              </form>
            </div>
          </>
        ) : null}
      </AppShell>
    );
  };
}
