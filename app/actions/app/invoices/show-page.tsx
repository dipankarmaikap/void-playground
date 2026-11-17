import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import type { Client, Invoice, InvoiceLine } from '../../../data/db.ts';
import { countryName } from '../../../data/client-billing.ts';
import { clientTaxTypeLabel } from '../../../data/client-tax.ts';
import { formatMoney, formatMoneySigned } from '../../../data/invoice-calculation.ts';
import {
  groupedInvoiceTaxes,
  invoiceLineGstComponents,
} from '../../../data/invoice-tax.ts';
import { DRAFT_STATUS_LABEL } from '../../../data/invoices.ts';
import { invoiceDisplayStatus } from '../../../data/invoice-issuance.ts';
import { PAYMENT_TERM_LABELS } from '../../../data/organization-invoicing.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import {
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../ui/page-styles.ts';
import { colors, radius } from '../../../ui/theme.ts';

export interface InvoiceShowPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  invoice: Invoice;
  lines: InvoiceLine[];
  client: Client | null;
  message?: string;
  validationErrors?: readonly string[];
  internalNoteValue?: string;
  internalNoteError?: string;
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

export function InvoiceShowPage(handle: Handle<InvoiceShowPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      invoice,
      lines,
      client,
      message,
      validationErrors = [],
      internalNoteValue,
      internalNoteError,
    } = handle.props;
    let taxSummary = groupedInvoiceTaxes(lines, invoice.currency);
    let displayStatus = invoiceDisplayStatus(invoice);
    let isDraft = invoice.status === 'draft';
    let recipientAddress = [
      invoice.recipient_billing_line1,
      invoice.recipient_billing_locality,
      invoice.recipient_billing_region,
      invoice.recipient_billing_postal_code,
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ');
    let sellerAddress = [
      invoice.seller_address_line1,
      invoice.seller_address_locality,
      invoice.seller_address_region,
      invoice.seller_address_postal_code,
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ');
    let pageTitle = isDraft
      ? 'Invoice draft'
      : displayStatus === 'overdue'
        ? 'Overdue invoice'
        : 'Sent invoice';

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title={pageTitle}
        description={`${isDraft ? 'Draft' : displayStatus === 'overdue' ? 'Overdue' : 'Sent'} invoice for ${invoice.recipient_legal_name}.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>{pageTitle}</h1>
          <p mix={pageIntroStyle}>
            Status: {isDraft ? DRAFT_STATUS_LABEL : displayStatus === 'overdue' ? 'Overdue' : 'Sent'}.
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
