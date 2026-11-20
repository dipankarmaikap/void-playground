import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import type { CreditNote, Invoice, InvoiceLine } from '../../../../data/db.ts';
import { joinAddressParts } from '../../../../data/address.ts';
import { countryName } from '../../../../data/client-billing.ts';
import {
  formatMoney,
  formatScaledDecimal,
  parseScaledDecimal,
} from '../../../../data/invoices/calculation.ts';
import type { CreditNoteDraftIssue } from '../../../../data/invoices/credit-notes.ts';
import type { CreditNoteLineCapacity } from '../../../../data/invoices/credit-notes.ts';
import type { CreditNoteFormValues } from '../../../../data/invoices/credit-note-form-values.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import { Button, linkButtonStyle } from '../../../../ui/button.tsx';
import { Field } from '../../../../ui/field.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { Input } from '../../../../ui/input.tsx';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { RestfulForm } from '../../../../ui/public/restful-form.tsx';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors, radius } from '../../../../ui/theme.ts';
import { cardStyle } from '../ui/card-style.ts';
import { routes } from '../../../../routes.ts';
import { creditNoteFormFields } from './public/schema.ts';

/** Shared Draft form for the Credit Notes create and edit routes. */
export interface CreditNoteDraftPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  invoice: Invoice;
  creditNote?: CreditNote;
  lines: InvoiceLine[];
  creditableQuantities: ReadonlyMap<string, CreditNoteLineCapacity>;
  creditDate: string;
  action: string;
  method?: 'POST' | 'PUT';
  heading: string;
  submitLabel: string;
  values: CreditNoteFormValues;
  issues?: readonly CreditNoteDraftIssue[];
  message?: string;
}

/** Roomier spacing for the credit note draft's cards. */
const cardGapStyle = css({ gap: '0.875rem' });

const detailsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
  gap: '1rem',
});

const detailStyle = css({ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 });
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' });
const lineStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(12rem, 1fr) minmax(9rem, 14rem)',
  gap: '1rem',
  alignItems: 'end',
  paddingBlock: '0.75rem',
  borderBottom: `1px solid ${colors.border}`,
});
const noteStyle = css({
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

function maxQuantity(
  line: InvoiceLine,
  creditableQuantities: ReadonlyMap<string, CreditNoteLineCapacity>,
): string {
  let capacity = creditableQuantities.get(line.id);
  if (capacity) return capacity.quantity;
  let quantity = parseScaledDecimal(line.quantity);
  return quantity == null ? line.quantity : formatScaledDecimal(quantity);
}

export function CreditNoteDraftPage(handle: Handle<CreditNoteDraftPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      invoice,
      creditNote,
      lines,
      creditableQuantities,
      creditDate,
      action,
      method = 'POST',
      heading,
      submitLabel,
      values,
      issues = [],
      message,
    } = handle.props;
    let valueByLineId = new Map(
      values.lines.map((line) => [line.invoice_line_id, line.quantity]),
    );
    let creditDateError = issues.find((issue) => issue.field === 'credit_date')?.message;
    let reasonError = issues.find((issue) => issue.field === 'reason')?.message;
    let generalErrors = issues.filter(
      (issue) => issue.field === 'lines' || issue.field === 'line_quantity' && !issue.lineId,
    );
    let sellerAddress = joinAddressParts([
      invoice.seller_address_line1,
      invoice.seller_address_locality,
      invoice.seller_address_region,
      invoice.seller_address_postal_code,
    ]);
    let recipientAddress = joinAddressParts([
      invoice.recipient_billing_line1,
      invoice.recipient_billing_locality,
      invoice.recipient_billing_region,
      invoice.recipient_billing_postal_code,
    ]);
    let taxRegimeLabel =
      invoice.gst_mode === 'india_gst'
        ? 'Indian GST'
        : invoice.gst_mode === 'foreign_manual'
          ? 'Manual foreign tax'
          : 'No tax';

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title={heading}
        description={`${heading.startsWith('Edit') ? 'Edit' : 'Create'} a credit note for invoice ${invoice.invoice_number}.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>{heading}</h1>
          <p mix={pageIntroStyle}>
            This draft is linked to invoice {invoice.invoice_number} and does not change its balance
            until issued.
          </p>
        </header>

        {issues.length > 0 ? (
          <div role="alert" mix={[cardStyle, cardGapStyle]}>
            <p>Please correct the following credit note details.</p>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.field}-${issue.lineId ?? ''}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {message ? <p role="status">{message}</p> : null}

        <section aria-labelledby="credit-note-snapshot-heading" mix={[cardStyle, cardGapStyle]}>
          <h2 id="credit-note-snapshot-heading">Original invoice snapshots</h2>
          <div mix={detailsStyle}>
            <p mix={detailStyle}>Seller: {invoice.seller_legal_name}</p>
            <p mix={detailStyle}>Seller address: {sellerAddress}</p>
            <p mix={detailStyle}>Seller country: {countryName(invoice.seller_country)}</p>
            <p mix={detailStyle}>Recipient: {invoice.recipient_legal_name}</p>
            <p mix={detailStyle}>Recipient address: {recipientAddress || '—'}</p>
            <p mix={detailStyle}>
              Recipient tax identifier:{' '}
              {invoice.recipient_tax_value
                ? `${invoice.recipient_tax_type?.toUpperCase() ?? 'Tax'} ${invoice.recipient_tax_value}`
                : '—'}
            </p>
            <p mix={detailStyle}>Original invoice: {invoice.invoice_number}</p>
            <p mix={detailStyle}>Original invoice date: {invoice.invoice_date}</p>
            <p mix={detailStyle}>Currency: {invoice.currency}</p>
            <p mix={detailStyle}>Tax regime: {taxRegimeLabel}</p>
            {invoice.gst_mode === 'india_gst' ? (
              <p mix={detailStyle}>
                Place of Supply:{' '}
                {invoice.supply_type === 'domestic'
                  ? invoice.place_of_supply_state_name ?? invoice.place_of_supply_state_code
                  : countryName(invoice.place_of_supply_country)}
              </p>
            ) : null}
          </div>
        </section>

        {creditNote ? (
          <section aria-label="Credit note draft total" mix={[cardStyle, cardGapStyle]}>
            <p mix={detailStyle}>
              Draft credit amount: {formatMoney(BigInt(creditNote.total_minor), invoice.currency)}
            </p>
          </section>
        ) : null}

        <RestfulForm
          method={method}
          action={action}
          aria-labelledby="credit-note-details-heading"
        >
          <input type="hidden" name="_csrf" value={csrfToken} />
          <section aria-labelledby="credit-note-details-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="credit-note-details-heading">Credit note details</h2>
            <Field
              label="Credit note date"
              error={creditDateError}
              errorId={creditDateError ? 'credit-note-date-error' : undefined}
            >
              <Input
                id="credit-note-date"
                name="credit_date"
                min={invoice.invoice_date}
                defaultValue={values.credit_date || creditDate}
                aria-describedby={creditDateError ? 'credit-note-date-error' : undefined}
                {...formFieldAttributes(creditNoteFormFields.credit_date, creditDateError)}
              />
            </Field>
            <Field
              label="Reason"
              error={reasonError}
              errorId={reasonError ? 'credit-note-reason-error' : undefined}
            >
              <textarea
                id="credit-note-reason"
                name="reason"
                defaultValue={values.reason}
                aria-describedby={reasonError ? 'credit-note-reason-error' : undefined}
                mix={noteStyle}
                {...formFieldAttributes(creditNoteFormFields.reason, reasonError)}
              />
            </Field>
          </section>

          <section aria-labelledby="credit-note-lines-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="credit-note-lines-heading">Service lines to credit</h2>
            {generalErrors.map((issue, index) => (
              <p key={`credit-note-lines-error-${index}`} role="alert">
                {issue.message}
              </p>
            ))}
            {lines.map((line) => (
              <div key={line.id} mix={lineStyle}>
                <div>
                  <p mix={detailStyle}>{line.description}</p>
                  <p mix={detailStyle}>SAC: {line.sac ?? '—'}</p>
                  <p mix={detailStyle}>
                    Creditable quantity: {maxQuantity(line, creditableQuantities)} · Unit price:{' '}
                    {line.unit_price} {invoice.currency}
                  </p>
                  <p mix={detailStyle}>
                    Remaining creditable line amount:{' '}
                    {formatMoney(
                      BigInt(creditableQuantities.get(line.id)?.amountMinor ?? line.amount_minor),
                      invoice.currency,
                    )}
                  </p>
                </div>
                <input type="hidden" name="line_id" value={line.id} />
                <Field
                  label="Quantity to credit"
                  error={issues.find(
                    (issue) => issue.field === 'line_quantity' && issue.lineId === line.id,
                  )?.message}
                  errorId={
                    issues.some(
                      (issue) => issue.field === 'line_quantity' && issue.lineId === line.id,
                    )
                      ? `credit-note-line-${line.id}-error`
                      : undefined
                  }
                >
                  <Input
                    id={`credit-note-line-${line.id}-quantity`}
                    name="line_quantity"
                    min="0"
                    max={maxQuantity(line, creditableQuantities)}
                    step="0.0001"
                    defaultValue={valueByLineId.get(line.id) ?? ''}
                    aria-describedby={
                      issues.some(
                        (issue) => issue.field === 'line_quantity' && issue.lineId === line.id,
                      )
                        ? `credit-note-line-${line.id}-error`
                        : undefined
                    }
                    {...formFieldAttributes(
                      creditNoteFormFields.line_quantity,
                      issues.find(
                        (issue) => issue.field === 'line_quantity' && issue.lineId === line.id,
                      ),
                    )}
                  />
                </Field>
              </div>
            ))}
            <Button type="submit">{submitLabel}</Button>
          </section>
        </RestfulForm>
        {creditNote ? (
          <div mix={actionsStyle}>
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
              action={routes.app.invoices.creditNotes.lifecycle.issue.href({
                invoiceId: invoice.id,
                creditNoteId: creditNote.id,
              })}
              aria-label="Issue credit note"
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <Button type="submit">Issue credit note</Button>
            </form>
            <details>
              <summary>Discard draft</summary>
              <div>
                <p>
                  Discarding this Draft permanently removes it. It does not change the original
                  invoice.
                </p>
                <form
                  method="post"
                  action={routes.app.invoices.creditNotes.lifecycle.discard.href({
                    invoiceId: invoice.id,
                    creditNoteId: creditNote.id,
                  })}
                  aria-label="Discard credit note draft"
                >
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <Button type="submit" variant="danger">
                    Confirm discard draft
                  </Button>
                </form>
              </div>
            </details>
          </div>
        ) : null}
      </AppShell>
    );
  };
}
