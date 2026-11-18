import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { clientDisplayLabel } from '../../../../data/client-names.ts';
import type { Client, Invoice, InvoiceLine } from '../../../../data/db.ts';
import { formatMoney } from '../../../../data/invoices/calculation.ts';
import { countryName } from '../../../../data/client-billing.ts';
import {
  groupedInvoiceTaxes,
  invoiceLineGstComponents,
} from '../../../../data/invoices/tax.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors } from '../../../../ui/theme.ts';
import type { InvoiceFormValues } from '../form-values.ts';
import { InvoiceForm } from '../invoice-form.tsx';

export interface EditInvoicePageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  invoice: Invoice;
  client: Client | null;
  lines: InvoiceLine[];
  values: InvoiceFormValues;
  issues?: readonly Issue[];
  gstRatePresets: readonly string[];
}

const hintStyle = css({ margin: 0, color: colors.muted, fontSize: '0.875rem' });

export function EditInvoicePage(handle: Handle<EditInvoicePageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      invoice,
      client,
      lines,
      values,
      issues,
      gstRatePresets,
    } = handle.props;
    let taxSummary = groupedInvoiceTaxes(lines, invoice.currency);

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title="Edit invoice draft"
        description={`Edit draft for ${invoice.recipient_legal_name}.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Edit invoice draft</h1>
          <p mix={pageIntroStyle}>
            Drafts stay editable until issued. Recipient changes affect this invoice only.
          </p>
        </header>
        {invoice.gst_mode === 'india_gst' || invoice.gst_mode === 'foreign_manual' ? (
          <section aria-labelledby="saved-tax-summary-heading">
            <h2 id="saved-tax-summary-heading">
              {invoice.gst_mode === 'foreign_manual' ? 'Current manual tax summary' : 'Current GST summary'}
            </h2>
            {invoice.gst_mode === 'india_gst' ? (
              <>
                {invoice.supply_type === 'export_lut' ? (
                  <p>Export endorsement: Export under LUT/Bond without payment of IGST.</p>
                ) : invoice.supply_type === 'export_igst' ? (
                  <p>
                    Export endorsement: Export with IGST. Place of Supply:{' '}
                    {countryName(invoice.place_of_supply_country)}
                  </p>
                ) : null}
                {invoice.export_reference ? <p>Export reference: {invoice.export_reference}</p> : null}
                {invoice.reverse_charge ? (
                  <p>Reverse charge applies; disclosed GST is payable by recipient.</p>
                ) : null}
                <ul>
                  {lines.map((line) => {
                    let components = invoiceLineGstComponents(line, invoice.currency);
                    return (
                      <li key={line.id}>
                        {line.description}: {line.tax_treatment?.replace('_', '-') ?? '—'}
                        {components.length > 0 ? ` · ${components.join(' · ')}` : ' · 0%'}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            <h3>Grouped tax summary</h3>
            {taxSummary.length > 0 ? (
              <ul>
                {taxSummary.map((tax) => (
                  <li key={tax.label}>
                    {tax.label}: {tax.formattedAmount}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{invoice.gst_mode === 'foreign_manual' ? 'No manual foreign tax.' : 'No GST charged.'}</p>
            )}
            <p>
              {invoice.reverse_charge ? 'Tax payable by recipient: ' : 'Total tax: '}
              {formatMoney(BigInt(invoice.tax_total_minor), invoice.currency)}
            </p>
          </section>
        ) : null}
        <InvoiceForm
          csrfToken={csrfToken}
          action={routes.app.invoices.edit.action.href({ invoiceId: invoice.id })}
          submitLabel="Save draft"
          values={values}
          issues={issues}
          gstRatePresets={gstRatePresets}
        >
          <p mix={hintStyle}>
            Bill to: {client ? clientDisplayLabel(client) : invoice.recipient_legal_name}
          </p>
        </InvoiceForm>
      </AppShell>
    );
  };
}
