/**
 * Shared form fixture for Invoicing settings tests. Mirrors every control the page submits so a
 * test posts exactly what the browser posts, including the #41 defaults, numbering, and image
 * fields. Individual tests override only what they care about.
 */
export function invoicingFormFields(overrides: Record<string, string> = {}) {
  return {
    // #39 seller profile and #40 tax registration
    legal_name: '',
    address_line1: '',
    address_locality: '',
    address_region: '',
    address_postal_code: '',
    address_country: '',
    billing_email: '',
    billing_phone: '',
    pan: '',
    gst_registered: '',
    gstin: '',
    gst_state_code: '',
    // #41 invoicing defaults
    default_currency: 'INR',
    payment_term: 'due_on_receipt',
    custom_payment_terms: '',
    payment_instructions: '',
    customer_notes: '',
    // #41 numbering series
    invoice_prefix: 'INV',
    invoice_starting_number: '1',
    credit_note_prefix: 'CN',
    credit_note_starting_number: '1',
    // #41 branding and signature
    logo: '',
    remove_logo: '',
    signature_image: '',
    remove_signature_image: '',
    signatory_name: '',
    signatory_designation: '',
    ...overrides,
  };
}
