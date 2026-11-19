import type { Client, Invoice, InvoiceLine } from '../../../data/db.ts';
import type { InvoiceDraftInput, InvoiceDraftLineInput } from '../../../data/invoices/draft.ts';
import { formatMinorInput } from '../../../data/invoices/calculation.ts';
import { suggestDueDate } from '../../../data/invoices/dates.ts';
import { findIndiaStateByCode, INDIA_STATES } from '../../../data/india-states.ts';
import { isIndiaCountry } from '../../../data/client-tax.ts';
import type { InvoicingProfileView } from '../../../data/organization/invoicing.ts';
import { LINE_FIELDS } from './public/schema.ts';

/** One editable free-form service line as it appears in a submitted form. */
export type InvoiceLineFormValue = InvoiceDraftLineInput;

/** The string snapshot a Draft invoice form submits or re-renders after validation fails. */
export interface InvoiceFormValues extends InvoiceDraftInput {
  client_id: string;
  /** Carried for redisplay only; the saved name is always derived from the State/UT code. */
  recipient_tax_state_name: string;
}

export function emptyInvoiceFormValues(): InvoiceFormValues {
  return {
    client_id: '',
    currency: '',
    invoice_date: '',
    due_date: '',
    payment_term: '',
    custom_payment_terms: '',
    recipient_legal_name: '',
    recipient_billing_line1: '',
    recipient_billing_locality: '',
    recipient_billing_region: '',
    recipient_billing_postal_code: '',
    recipient_billing_country: '',
    recipient_tax_country: '',
    recipient_tax_type: '',
    recipient_tax_value: '',
    recipient_tax_state_code: '',
    recipient_tax_state_name: '',
    recipient_gstin_applicable: '',
    gst_mode: 'none',
    supply_type: '',
    place_of_supply_state_code: '',
    place_of_supply_country: '',
    reverse_charge: '',
    export_reference: '',
    payment_instructions: '',
    customer_notes: '',
    internal_note: '',
    invoice_discount_mode: '',
    invoice_discount_value: '',
    round_off: '',
    lines: [
      Object.fromEntries(LINE_FIELDS.map((field) => [field, ''])) as unknown as InvoiceLineFormValue,
    ],
  };
}

/** Values copied from a selected Active Client and the Organization's invoicing defaults. */
export function draftFormValuesFor(
  client: Client,
  view: InvoicingProfileView,
  today: string,
): InvoiceFormValues {
  return {
    ...emptyInvoiceFormValues(),
    client_id: client.id,
    currency: client.billing_currency || view.default_currency,
    invoice_date: today,
    due_date: suggestDueDate(today, view.payment_term),
    payment_term: view.payment_term,
    custom_payment_terms: view.custom_payment_terms ?? '',
    recipient_legal_name: client.legal_name,
    recipient_billing_line1: client.billing_line1 ?? '',
    recipient_billing_locality: client.billing_locality ?? '',
    recipient_billing_region: client.billing_region ?? '',
    recipient_billing_postal_code: client.billing_postal_code ?? '',
    recipient_billing_country: client.billing_country ?? '',
    recipient_tax_country: client.tax_country ?? '',
    recipient_tax_type: client.tax_type ?? '',
    recipient_tax_value: client.tax_value ?? '',
    recipient_tax_state_code: client.tax_state_code ?? '',
    recipient_tax_state_name: client.tax_state_name ?? '',
    gst_mode: view.gst_registered ? 'india_gst' : 'none',
    supply_type: view.gst_registered ? 'domestic' : '',
    place_of_supply_state_code: defaultPlaceOfSupply(client),
    place_of_supply_country: '',
    recipient_gstin_applicable: '',
    reverse_charge: '',
    export_reference: '',
    payment_instructions: view.payment_instructions ?? '',
    customer_notes: view.customer_notes ?? '',
    internal_note: '',
  };
}

export function invoiceFormValuesOf(
  invoice: Invoice,
  lines: InvoiceLine[],
): InvoiceFormValues {
  return {
    client_id: invoice.client_id,
    currency: invoice.currency,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    payment_term: invoice.payment_term,
    custom_payment_terms: invoice.custom_payment_terms ?? '',
    recipient_legal_name: invoice.recipient_legal_name,
    recipient_billing_line1: invoice.recipient_billing_line1 ?? '',
    recipient_billing_locality: invoice.recipient_billing_locality ?? '',
    recipient_billing_region: invoice.recipient_billing_region ?? '',
    recipient_billing_postal_code: invoice.recipient_billing_postal_code ?? '',
    recipient_billing_country: invoice.recipient_billing_country ?? '',
    recipient_tax_country: invoice.recipient_tax_country ?? '',
    recipient_tax_type: invoice.recipient_tax_type ?? '',
    recipient_tax_value: invoice.recipient_tax_value ?? '',
    recipient_tax_state_code: invoice.recipient_tax_state_code ?? '',
    recipient_tax_state_name: invoice.recipient_tax_state_name ?? '',
    gst_mode: invoice.gst_mode,
    supply_type: invoice.supply_type ?? '',
    place_of_supply_state_code: invoice.place_of_supply_state_code ?? '',
    place_of_supply_country: invoice.place_of_supply_country ?? '',
    recipient_gstin_applicable: invoice.recipient_gstin_applicable ? 'on' : '',
    reverse_charge: invoice.reverse_charge ? 'on' : '',
    export_reference: invoice.export_reference ?? '',
    payment_instructions: invoice.payment_instructions ?? '',
    customer_notes: invoice.customer_notes ?? '',
    internal_note: invoice.internal_note ?? '',
    invoice_discount_mode: invoice.invoice_discount_mode ?? '',
    invoice_discount_value: invoice.invoice_discount_value ?? '',
    round_off:
      invoice.round_off_minor === 0
        ? ''
        : formatMinorInput(BigInt(invoice.round_off_minor), invoice.currency),
    lines: lines.map((line) => ({
      description: line.description,
      sac: line.sac ?? '',
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_mode: line.discount_mode ?? '',
      discount_value: line.discount_value ?? '',
      tax_treatment: line.tax_treatment ?? '',
      gst_rate: line.gst_rate ?? '',
      foreign_tax_label: line.foreign_tax_label ?? '',
      foreign_tax_mode: line.foreign_tax_mode ?? '',
      foreign_tax_value:
        line.foreign_tax_mode === 'percent'
          ? line.foreign_tax_rate ?? ''
          : line.foreign_tax_mode === 'fixed'
            ? formatMinorInput(BigInt(line.foreign_tax_amount_minor), invoice.currency)
            : '',
    })),
  };
}

function defaultPlaceOfSupply(client: Client): string {
  if (
    client.tax_state_code &&
    (!client.tax_country || isIndiaCountry(client.tax_country)) &&
    findIndiaStateByCode(client.tax_state_code)
  ) {
    return client.tax_state_code;
  }
  if (!client.billing_country || !isIndiaCountry(client.billing_country)) return '';
  let region = (client.billing_region ?? '').trim().toLowerCase();
  let state = INDIA_STATES.find(
    (candidate) =>
      candidate.name.toLowerCase() === region ||
      candidate.code === region ||
      `${candidate.code} - ${candidate.name}`.toLowerCase() === region,
  );
  return state?.code ?? '';
}
