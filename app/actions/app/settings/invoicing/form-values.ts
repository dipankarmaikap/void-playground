import type { InvoicingProfileInput, InvoicingProfileView } from '../../../../data/organization-invoicing.ts';

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
  };
}

function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
