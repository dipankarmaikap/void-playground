import type { Client, Invoice, InvoiceLine } from '../../../data/db.ts';
import { suggestDueDate } from '../../../data/invoice-dates.ts';
import type { InvoicingProfileView } from '../../../data/organization-invoicing.ts';

/** One editable free-form service line as it appears in a submitted form. */
export interface InvoiceLineFormValue {
  description: string;
  sac: string;
  quantity: string;
  unit_price: string;
}

/** The string snapshot a Draft invoice form submits or re-renders after validation fails. */
export interface InvoiceFormValues {
  client_id: string;
  currency: string;
  invoice_date: string;
  due_date: string;
  payment_term: string;
  custom_payment_terms: string;
  recipient_legal_name: string;
  recipient_billing_line1: string;
  recipient_billing_locality: string;
  recipient_billing_region: string;
  recipient_billing_postal_code: string;
  recipient_billing_country: string;
  recipient_tax_country: string;
  recipient_tax_type: string;
  recipient_tax_value: string;
  recipient_tax_state_code: string;
  /** Carried for redisplay only; the saved name is always derived from the State/UT code. */
  recipient_tax_state_name: string;
  payment_instructions: string;
  customer_notes: string;
  internal_note: string;
  lines: InvoiceLineFormValue[];
}

const LINE_FIELDS = ['description', 'sac', 'quantity', 'unit_price'] as const;

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
    payment_instructions: '',
    customer_notes: '',
    internal_note: '',
    lines: [{ description: '', sac: '', quantity: '', unit_price: '' }],
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
    payment_instructions: invoice.payment_instructions ?? '',
    customer_notes: invoice.customer_notes ?? '',
    internal_note: invoice.internal_note ?? '',
    lines: lines.map((line) => ({
      description: line.description,
      sac: line.sac ?? '',
      quantity: line.quantity,
      unit_price: line.unit_price,
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
    payment_instructions: readText(formData, 'payment_instructions'),
    customer_notes: readText(formData, 'customer_notes'),
    internal_note: readText(formData, 'internal_note'),
    lines,
  };
}
