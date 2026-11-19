import type {
  InvoicingProfileInput,
  InvoicingProfileView,
} from '../../../../data/organization/invoicing.ts';

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
