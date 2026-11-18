import {
  DEFAULT_CREDIT_NOTE_PREFIX,
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_PAYMENT_TERM,
  DEFAULT_STARTING_NUMBER,
} from '../../../../data/organization/invoicing.ts';
import type { InvoicingProfileInput, InvoicingProfileView } from '../../../../data/organization/invoicing.ts';

/** The string values the Invoicing form submits, kept separate from normalized stored values. */
export interface InvoicingFormValues extends Required<InvoicingProfileInput> {}

export function invoicingFormValuesOf(view: InvoicingProfileView): InvoicingFormValues {
  return {
    legal_name: view.explicitLegalName ?? '',
    address_line1: view.address_line1 ?? '',
    address_locality: view.address_locality ?? '',
    address_region: view.address_region ?? '',
    address_postal_code: view.address_postal_code ?? '',
    address_country: view.address_country ?? '',
    billing_email: view.billing_email ?? '',
    billing_phone: view.billing_phone ?? '',
    pan: view.pan ?? '',
    gst_registered: view.gst_registered ? 'on' : '',
    gstin: view.gstin ?? '',
    gst_state_code: view.gst_state_code ?? '',
    default_currency: view.default_currency,
    payment_term: view.payment_term,
    custom_payment_terms: view.custom_payment_terms ?? '',
    payment_instructions: view.payment_instructions ?? '',
    customer_notes: view.customer_notes ?? '',
    invoice_prefix: view.invoice_prefix,
    invoice_starting_number: String(view.invoice_starting_number),
    credit_note_prefix: view.credit_note_prefix,
    credit_note_starting_number: String(view.credit_note_starting_number),
    logo: '',
    remove_logo: '',
    signature_image: '',
    remove_signature_image: '',
    signatory_name: view.signatory_name ?? '',
    signatory_designation: view.signatory_designation ?? '',
  };
}

/** Reads exactly what was submitted so validation errors can re-render it unchanged. */
export function readInvoicingFormValues(formData: FormData): InvoicingFormValues {
  return {
    legal_name: readText(formData, 'legal_name'),
    address_line1: readText(formData, 'address_line1'),
    address_locality: readText(formData, 'address_locality'),
    address_region: readText(formData, 'address_region'),
    address_postal_code: readText(formData, 'address_postal_code'),
    address_country: readText(formData, 'address_country'),
    billing_email: readText(formData, 'billing_email'),
    billing_phone: readText(formData, 'billing_phone'),
    pan: readText(formData, 'pan'),
    gst_registered: readText(formData, 'gst_registered'),
    gstin: readText(formData, 'gstin'),
    gst_state_code: readText(formData, 'gst_state_code'),
    default_currency: readText(formData, 'default_currency', DEFAULT_CURRENCY),
    payment_term: readText(formData, 'payment_term', DEFAULT_PAYMENT_TERM),
    custom_payment_terms: readText(formData, 'custom_payment_terms'),
    payment_instructions: readText(formData, 'payment_instructions'),
    customer_notes: readText(formData, 'customer_notes'),
    invoice_prefix: readText(formData, 'invoice_prefix', DEFAULT_INVOICE_PREFIX),
    invoice_starting_number: readText(
      formData,
      'invoice_starting_number',
      String(DEFAULT_STARTING_NUMBER),
    ),
    credit_note_prefix: readText(formData, 'credit_note_prefix', DEFAULT_CREDIT_NOTE_PREFIX),
    credit_note_starting_number: readText(
      formData,
      'credit_note_starting_number',
      String(DEFAULT_STARTING_NUMBER),
    ),
    logo: readText(formData, 'logo'),
    remove_logo: readText(formData, 'remove_logo'),
    signature_image: readText(formData, 'signature_image'),
    remove_signature_image: readText(formData, 'remove_signature_image'),
    signatory_name: readText(formData, 'signatory_name'),
    signatory_designation: readText(formData, 'signatory_designation'),
  };
}

/**
 * Reads a submitted control. Older callers that omit a newly introduced control entirely get the
 * documented default; a control that is present but blank is left blank so validation can reject it.
 */
function readText(formData: FormData, name: string, fallback = ''): string {
  if (!formData.has(name)) return fallback;
  let value = formData.get(name);
  return typeof value === 'string' ? value : fallback;
}
