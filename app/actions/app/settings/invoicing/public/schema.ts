import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import { CLIENT_TEXT_LIMITS } from '../../../../../data/client-text.ts';
import type { InvoicingProfileInput } from '../../../../../data/organization/invoicing.ts';
import type { FormFieldDescriptor } from '../../../../../ui/public/form-field.ts';

/**
 * The defaults an omitted control falls back to. These mirror the domain defaults in
 * `app/data/organization/invoicing.ts` (pinned by the colocated schema test); the schema module
 * restates them because the domain module is server-only and this module ships to the browser.
 */
export const INVOICING_FORM_DEFAULTS = {
  default_currency: 'INR',
  payment_term: 'due_on_receipt',
  invoice_prefix: 'INV',
  invoice_starting_number: '1',
  credit_note_prefix: 'CN',
  credit_note_starting_number: '1',
} as const;

/** Longest PAN and GSTIN the form accepts. */
const PAN_MAX_LENGTH = 10;
const GSTIN_MAX_LENGTH = 15;

/** Longest document prefixes the form accepts. */
const PREFIX_MAX_LENGTH = 12;

/** Longest free-form defaults and notes the form accepts. */
const CUSTOM_TERMS_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 1000;

/** Longest signatory fields the form accepts. */
const SIGNATORY_NAME_MAX_LENGTH = 120;
const SIGNATORY_DESIGNATION_MAX_LENGTH = 100;

/**
 * The Invoicing settings form, described once. Every field is read as a string; the domain
 * parser (`parseInvoicingProfile`) owns the real validation. A control omitted entirely falls
 * back to its documented default, matching the form's progressive-introduction contract. The
 * descriptor table supplies the input attributes the invoicing page renders.
 */
export const InvoicingForm = f.object({
  legal_name: f.field(s.defaulted(s.string(), '')),
  address_line1: f.field(s.defaulted(s.string(), '')),
  address_locality: f.field(s.defaulted(s.string(), '')),
  address_region: f.field(s.defaulted(s.string(), '')),
  address_postal_code: f.field(s.defaulted(s.string(), '')),
  address_country: f.field(s.defaulted(s.string(), '')),
  billing_email: f.field(s.defaulted(s.string(), '')),
  billing_phone: f.field(s.defaulted(s.string(), '')),
  pan: f.field(s.defaulted(s.string(), '')),
  gst_registered: f.field(s.defaulted(s.string(), '')),
  gstin: f.field(s.defaulted(s.string(), '')),
  gst_state_code: f.field(s.defaulted(s.string(), '')),
  default_currency: f.field(
    s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.default_currency),
  ),
  payment_term: f.field(s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.payment_term)),
  custom_payment_terms: f.field(s.defaulted(s.string(), '')),
  payment_instructions: f.field(s.defaulted(s.string(), '')),
  customer_notes: f.field(s.defaulted(s.string(), '')),
  invoice_prefix: f.field(s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.invoice_prefix)),
  invoice_starting_number: f.field(
    s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.invoice_starting_number),
  ),
  credit_note_prefix: f.field(
    s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.credit_note_prefix),
  ),
  credit_note_starting_number: f.field(
    s.defaulted(s.string(), INVOICING_FORM_DEFAULTS.credit_note_starting_number),
  ),
  logo: f.field(s.defaulted(s.string(), '')),
  remove_logo: f.field(s.defaulted(s.string(), '')),
  signature_image: f.field(s.defaulted(s.string(), '')),
  remove_signature_image: f.field(s.defaulted(s.string(), '')),
  signatory_name: f.field(s.defaulted(s.string(), '')),
  signatory_designation: f.field(s.defaulted(s.string(), '')),
});

export const invoicingFormFields = {
  legal_name: { maxLength: CLIENT_TEXT_LIMITS.legal_name, autoComplete: 'organization' },
  address_line1: { maxLength: CLIENT_TEXT_LIMITS.billing_line1, autoComplete: 'address-line1' },
  address_locality: {
    maxLength: CLIENT_TEXT_LIMITS.billing_locality,
    autoComplete: 'address-level2',
  },
  address_region: { maxLength: CLIENT_TEXT_LIMITS.billing_region, autoComplete: 'address-level1' },
  address_postal_code: {
    maxLength: CLIENT_TEXT_LIMITS.billing_postal_code,
    autoComplete: 'postal-code',
  },
  address_country: { maxLength: CLIENT_TEXT_LIMITS.billing_country, autoComplete: 'country-name' },
  billing_email: { type: 'email', maxLength: CLIENT_TEXT_LIMITS.email, autoComplete: 'email' },
  billing_phone: { type: 'tel', maxLength: CLIENT_TEXT_LIMITS.phone, autoComplete: 'tel' },
  pan: { maxLength: PAN_MAX_LENGTH, autoComplete: 'off' },
  gst_registered: { control: 'checkbox' },
  gstin: { maxLength: GSTIN_MAX_LENGTH, autoComplete: 'off' },
  gst_state_code: { control: 'select' },
  default_currency: { maxLength: 3, autoComplete: 'off' },
  payment_term: { control: 'select' },
  custom_payment_terms: { control: 'textarea', maxLength: CUSTOM_TERMS_MAX_LENGTH },
  payment_instructions: { control: 'textarea', maxLength: NOTES_MAX_LENGTH },
  customer_notes: { control: 'textarea', maxLength: NOTES_MAX_LENGTH },
  invoice_prefix: { maxLength: PREFIX_MAX_LENGTH, autoComplete: 'off' },
  invoice_starting_number: { autoComplete: 'off' },
  credit_note_prefix: { maxLength: PREFIX_MAX_LENGTH, autoComplete: 'off' },
  credit_note_starting_number: { autoComplete: 'off' },
  logo: { autoComplete: 'off' },
  remove_logo: { control: 'checkbox' },
  signature_image: { autoComplete: 'off' },
  remove_signature_image: { control: 'checkbox' },
  signatory_name: { maxLength: SIGNATORY_NAME_MAX_LENGTH, autoComplete: 'name' },
  signatory_designation: {
    maxLength: SIGNATORY_DESIGNATION_MAX_LENGTH,
    autoComplete: 'organization-title',
  },
} satisfies Record<string, FormFieldDescriptor>;

/** The GST rate preset forms (add, update, remove), described once. */
export const PresetRateForm = f.object({
  rate: f.field(s.defaulted(s.string(), '')),
  preset_id: f.field(s.defaulted(s.string(), '')),
});

export const presetFormFields = {
  rate: { type: 'text' },
  preset_id: { control: 'hidden' },
} satisfies Record<string, FormFieldDescriptor>;

type InvoicingFormValues = Required<InvoicingProfileInput>;

/** Reads an invoicing submission, failing closed to the defaults of an empty form. */
export function invoicingValuesOf(formData: FormData): InvoicingFormValues {
  let parsed = s.parseSafe(InvoicingForm, formData);
  return parsed.success ? parsed.value : invoicingValuesOf(new FormData());
}

/** Reads a preset submission, failing closed to blank values. */
export function presetValuesOf(formData: FormData): { rate: string; presetId: string } {
  let parsed = s.parseSafe(PresetRateForm, formData);
  return parsed.success
    ? { rate: parsed.value.rate, presetId: parsed.value.preset_id }
    : { rate: '', presetId: '' };
}
