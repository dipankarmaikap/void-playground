import type { Client, Invoice, InvoiceLine } from '../../../data/db.ts';
import type { InvoiceDraftInput, InvoiceDraftLineInput } from '../../../data/invoice-draft.ts';
import { formatMinorInput } from '../../../data/invoice-calculation.ts';
import { suggestDueDate } from '../../../data/invoice-dates.ts';
import { findIndiaStateByCode, INDIA_STATES } from '../../../data/india-states.ts';
import { isIndiaCountry } from '../../../data/client-tax.ts';
import type { InvoicingProfileView } from '../../../data/organization-invoicing.ts';

/** One editable free-form service line as it appears in a submitted form. */
export type InvoiceLineFormValue = InvoiceDraftLineInput;

/** The string snapshot a Draft invoice form submits or re-renders after validation fails. */
export interface InvoiceFormValues extends InvoiceDraftInput {
  client_id: string;
  /** Carried for redisplay only; the saved name is always derived from the State/UT code. */
  recipient_tax_state_name: string;
  recipient_gstin_applicable: string;
}

const LINE_FIELDS = [
  'description',
  'sac',
  'quantity',
  'unit_price',
  'discount_mode',
  'discount_value',
  'tax_treatment',
  'gst_rate',
  'foreign_tax_label',
  'foreign_tax_mode',
  'foreign_tax_value',
] as const;

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
      {
        description: '',
        sac: '',
        quantity: '',
        unit_price: '',
        discount_mode: '',
        discount_value: '',
        tax_treatment: '',
        gst_rate: '',
        foreign_tax_label: '',
        foreign_tax_mode: '',
        foreign_tax_value: '',
      },
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

function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** Reads repeated `line_*` fields back into a stable array of service lines. */
export function readInvoiceFormValues(formData: FormData): InvoiceFormValues {
  let descriptions = formData.getAll('line_description');
  let count = Math.max(1, descriptions.length);
  let lines: InvoiceLineFormValue[] = [];
  for (let index = 0; index < count; index += 1) {
    let line = {} as InvoiceLineFormValue;
    for (let field of LINE_FIELDS) {
      let values = formData.getAll(`line_${field}`);
      let value = values[index];
      line[field] = typeof value === 'string' ? value : '';
    }
    lines.push(line);
  }

  return {
    client_id: readText(formData, 'client_id'),
    currency: readText(formData, 'currency'),
    invoice_date: readText(formData, 'invoice_date'),
    due_date: readText(formData, 'due_date'),
    payment_term: readText(formData, 'payment_term'),
    custom_payment_terms: readText(formData, 'custom_payment_terms'),
    recipient_legal_name: readText(formData, 'recipient_legal_name'),
    recipient_billing_line1: readText(formData, 'recipient_billing_line1'),
    recipient_billing_locality: readText(formData, 'recipient_billing_locality'),
    recipient_billing_region: readText(formData, 'recipient_billing_region'),
    recipient_billing_postal_code: readText(formData, 'recipient_billing_postal_code'),
    recipient_billing_country: readText(formData, 'recipient_billing_country'),
    recipient_tax_country: readText(formData, 'recipient_tax_country'),
    recipient_tax_type: readText(formData, 'recipient_tax_type'),
    recipient_tax_value: readText(formData, 'recipient_tax_value'),
    recipient_tax_state_code: readText(formData, 'recipient_tax_state_code'),
    recipient_tax_state_name: readText(formData, 'recipient_tax_state_name'),
    gst_mode: readText(formData, 'gst_mode'),
    supply_type: readText(formData, 'supply_type'),
    place_of_supply_state_code: readText(formData, 'place_of_supply_state_code'),
    place_of_supply_country: readText(formData, 'place_of_supply_country'),
    recipient_gstin_applicable: readText(formData, 'recipient_gstin_applicable'),
    reverse_charge: readText(formData, 'reverse_charge'),
    export_reference: readText(formData, 'export_reference'),
    payment_instructions: readText(formData, 'payment_instructions'),
    customer_notes: readText(formData, 'customer_notes'),
    internal_note: readText(formData, 'internal_note'),
    invoice_discount_mode: readText(formData, 'invoice_discount_mode'),
    invoice_discount_value: readText(formData, 'invoice_discount_value'),
    round_off: readText(formData, 'round_off'),
    lines,
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
