import * as s from 'remix/data-schema';
import type { Issue } from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import type { InvoiceFormValues, InvoiceLineFormValue } from '../form-values.ts';
import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/** Longest internal note an issued invoice accepts; the schema and the browser textarea share it. */
export const INTERNAL_NOTE_MAX_LENGTH = 1000;

/** The free-form service-line fields, submitted as repeated `line_*` form fields. */
export const LINE_FIELDS = [
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

/** Longest export reference the invoice form accepts. */
const EXPORT_REFERENCE_MAX_LENGTH = 200;

/** Longest free-form notes the invoice text areas accept. */
const NOTES_MAX_LENGTH = 1000;

/** Longest manual foreign-tax label a service line accepts. */
const FOREIGN_TAX_LABEL_MAX_LENGTH = 80;

/**
 * The Invoice Draft form, described once. Every field is read as a string; the domain parser
 * (`parseInvoiceDraft`) owns the real validation. The repeated `line_*` fields arrive as arrays
 * and are zipped back into service lines. The descriptor table supplies the input attributes the
 * invoice form renders.
 */
export const InvoiceDraftForm = f.object({
  client_id: f.field(s.defaulted(s.string(), '')),
  currency: f.field(s.defaulted(s.string(), '')),
  invoice_date: f.field(s.defaulted(s.string(), '')),
  due_date: f.field(s.defaulted(s.string(), '')),
  payment_term: f.field(s.defaulted(s.string(), '')),
  custom_payment_terms: f.field(s.defaulted(s.string(), '')),
  recipient_legal_name: f.field(s.defaulted(s.string(), '')),
  recipient_billing_line1: f.field(s.defaulted(s.string(), '')),
  recipient_billing_locality: f.field(s.defaulted(s.string(), '')),
  recipient_billing_region: f.field(s.defaulted(s.string(), '')),
  recipient_billing_postal_code: f.field(s.defaulted(s.string(), '')),
  recipient_billing_country: f.field(s.defaulted(s.string(), '')),
  recipient_tax_country: f.field(s.defaulted(s.string(), '')),
  recipient_tax_type: f.field(s.defaulted(s.string(), '')),
  recipient_tax_value: f.field(s.defaulted(s.string(), '')),
  recipient_tax_state_code: f.field(s.defaulted(s.string(), '')),
  recipient_tax_state_name: f.field(s.defaulted(s.string(), '')),
  gst_mode: f.field(s.defaulted(s.string(), '')),
  supply_type: f.field(s.defaulted(s.string(), '')),
  place_of_supply_state_code: f.field(s.defaulted(s.string(), '')),
  place_of_supply_country: f.field(s.defaulted(s.string(), '')),
  recipient_gstin_applicable: f.field(s.defaulted(s.string(), '')),
  reverse_charge: f.field(s.defaulted(s.string(), '')),
  export_reference: f.field(s.defaulted(s.string(), '')),
  payment_instructions: f.field(s.defaulted(s.string(), '')),
  customer_notes: f.field(s.defaulted(s.string(), '')),
  internal_note: f.field(s.defaulted(s.string(), '')),
  invoice_discount_mode: f.field(s.defaulted(s.string(), '')),
  invoice_discount_value: f.field(s.defaulted(s.string(), '')),
  round_off: f.field(s.defaulted(s.string(), '')),
  line_description: f.fields(s.array(s.string())),
  line_sac: f.fields(s.array(s.string())),
  line_quantity: f.fields(s.array(s.string())),
  line_unit_price: f.fields(s.array(s.string())),
  line_discount_mode: f.fields(s.array(s.string())),
  line_discount_value: f.fields(s.array(s.string())),
  line_tax_treatment: f.fields(s.array(s.string())),
  line_gst_rate: f.fields(s.array(s.string())),
  line_foreign_tax_label: f.fields(s.array(s.string())),
  line_foreign_tax_mode: f.fields(s.array(s.string())),
  line_foreign_tax_value: f.fields(s.array(s.string())),
});

export const invoiceDraftFormFields = {
  client_id: { control: 'hidden' },
  currency: { maxLength: 3 },
  invoice_date: { type: 'date' },
  due_date: { type: 'date' },
  payment_term: { control: 'select' },
  custom_payment_terms: { control: 'textarea', maxLength: 200 },
  recipient_legal_name: { type: 'text' },
  recipient_billing_line1: { type: 'text' },
  recipient_billing_locality: { type: 'text' },
  recipient_billing_region: { type: 'text' },
  recipient_billing_postal_code: { type: 'text' },
  recipient_billing_country: { type: 'text' },
  recipient_tax_country: { type: 'text' },
  recipient_tax_type: { type: 'text' },
  recipient_tax_value: { type: 'text' },
  recipient_tax_state_code: { type: 'text' },
  recipient_tax_state_name: { control: 'hidden' },
  gst_mode: { control: 'select' },
  supply_type: { control: 'select' },
  place_of_supply_state_code: { control: 'select' },
  place_of_supply_country: { type: 'text' },
  recipient_gstin_applicable: { control: 'checkbox' },
  reverse_charge: { control: 'checkbox' },
  export_reference: { maxLength: EXPORT_REFERENCE_MAX_LENGTH },
  payment_instructions: { control: 'textarea', maxLength: NOTES_MAX_LENGTH },
  customer_notes: { control: 'textarea', maxLength: NOTES_MAX_LENGTH },
  internal_note: { control: 'textarea', maxLength: INTERNAL_NOTE_MAX_LENGTH },
  invoice_discount_mode: { control: 'select' },
  invoice_discount_value: { type: 'text' },
  round_off: { type: 'text' },
  line_description: { type: 'text' },
  line_sac: { type: 'text' },
  line_quantity: { type: 'text' },
  line_unit_price: { type: 'text' },
  line_discount_mode: { control: 'select' },
  line_discount_value: { type: 'text' },
  line_tax_treatment: { control: 'select' },
  line_gst_rate: { control: 'select' },
  line_foreign_tax_label: { maxLength: FOREIGN_TAX_LABEL_MAX_LENGTH },
  line_foreign_tax_mode: { control: 'select' },
  line_foreign_tax_value: { type: 'text' },
} satisfies Record<string, FormFieldDescriptor>;

/** The internal-note form on an issued invoice, described once. */
export const InternalNoteForm = f.object({
  internal_note: f.field(s.defaulted(s.string(), '')),
});

export const internalNoteFormFields = {
  internal_note: { control: 'textarea', maxLength: INTERNAL_NOTE_MAX_LENGTH },
} satisfies Record<string, FormFieldDescriptor>;

type ParsedInvoiceDraftForm = {
  [key in keyof typeof invoiceDraftFormFields]: string[] | string;
};

/**
 * Parses the Invoice Draft form through the shared schema. The description count fixes the line
 * count and short arrays pad with empty strings, exactly as the form's line rows submit. A
 * submission the schema cannot read as text re-renders with empty values and the schema issues.
 */
export function parseInvoiceFormValues(
  formData: FormData,
): { values: InvoiceFormValues; issues: Issue[] } {
  let parsed = s.parseSafe(InvoiceDraftForm, formData);
  if (!parsed.success) {
    return { values: emptyInvoiceFormValues(), issues: [...parsed.issues] };
  }
  return { values: invoiceFormValuesOf(parsed.value), issues: [] };
}

function invoiceFormValuesOf(parsed: ParsedInvoiceDraftForm): InvoiceFormValues {
  let lineCount = Math.max(1, parsed.line_description.length);
  let lines: InvoiceLineFormValue[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    let line = {} as InvoiceLineFormValue;
    for (let field of LINE_FIELDS) {
      let values = parsed[`line_${field}`] as string[];
      line[field] = values[index] ?? '';
    }
    lines.push(line);
  }

  let values: Record<string, unknown> = { lines };
  for (let [key, value] of Object.entries(parsed)) {
    if (key.startsWith('line_')) continue;
    values[key] = value;
  }
  return values as unknown as InvoiceFormValues;
}

function emptyInvoiceFormValues(): InvoiceFormValues {
  let values: Record<string, unknown> = {
    lines: [Object.fromEntries(LINE_FIELDS.map((field) => [field, '']))],
  };
  for (let key of Object.keys(invoiceDraftFormFields)) {
    if (key.startsWith('line_')) continue;
    values[key] = '';
  }
  return values as unknown as InvoiceFormValues;
}
