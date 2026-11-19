import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import { CLIENT_NAME_MAX_LENGTH } from '../../../../data/client-names.ts';
import { CLIENT_TEXT_LIMITS } from '../../../../data/client-text.ts';
import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/**
 * The Client form, described once. The schema reads every submitted field as a string so the
 * section parsers receive complete values; each section's domain parser owns the real validation.
 * The descriptor table supplies the input attributes the section fields render, mirroring the
 * same limits the domain parsers enforce.
 */
export const ClientForm = f.object({
  type: f.field(s.defaulted(s.string(), '')),
  legal_name: f.field(s.defaulted(s.string(), '')),
  preferred_name: f.field(s.defaulted(s.string(), '')),
  trading_name: f.field(s.defaulted(s.string(), '')),
  industry: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  phone: f.field(s.defaulted(s.string(), '')),
  contact_name: f.field(s.defaulted(s.string(), '')),
  contact_role: f.field(s.defaulted(s.string(), '')),
  contact_email: f.field(s.defaulted(s.string(), '')),
  contact_phone: f.field(s.defaulted(s.string(), '')),
  tax_country: f.field(s.defaulted(s.string(), '')),
  tax_type: f.field(s.defaulted(s.string(), '')),
  tax_value: f.field(s.defaulted(s.string(), '')),
  tax_state_code: f.field(s.defaulted(s.string(), '')),
  billing_line1: f.field(s.defaulted(s.string(), '')),
  billing_locality: f.field(s.defaulted(s.string(), '')),
  billing_region: f.field(s.defaulted(s.string(), '')),
  billing_postal_code: f.field(s.defaulted(s.string(), '')),
  billing_country: f.field(s.defaulted(s.string(), '')),
  billing_currency: f.field(s.defaulted(s.string(), '')),
});

export const clientFormFields = {
  type: { control: 'select', required: true },
  legal_name: { required: true, maxLength: CLIENT_NAME_MAX_LENGTH },
  preferred_name: { maxLength: CLIENT_NAME_MAX_LENGTH },
  trading_name: { maxLength: CLIENT_NAME_MAX_LENGTH },
  industry: { maxLength: CLIENT_TEXT_LIMITS.industry },
  email: { type: 'email', maxLength: CLIENT_TEXT_LIMITS.email },
  phone: { type: 'tel', maxLength: CLIENT_TEXT_LIMITS.phone },
  contact_name: { maxLength: CLIENT_TEXT_LIMITS.contact_name },
  contact_role: { maxLength: CLIENT_TEXT_LIMITS.contact_role },
  contact_email: { type: 'email', maxLength: CLIENT_TEXT_LIMITS.contact_email },
  contact_phone: { type: 'tel', maxLength: CLIENT_TEXT_LIMITS.contact_phone },
  tax_country: { maxLength: CLIENT_TEXT_LIMITS.tax_country },
  tax_type: { maxLength: CLIENT_TEXT_LIMITS.tax_type },
  tax_value: { maxLength: CLIENT_TEXT_LIMITS.tax_value },
  tax_state_code: { control: 'select' },
  billing_line1: { maxLength: CLIENT_TEXT_LIMITS.billing_line1 },
  billing_locality: { maxLength: CLIENT_TEXT_LIMITS.billing_locality },
  billing_region: { maxLength: CLIENT_TEXT_LIMITS.billing_region },
  billing_postal_code: { maxLength: CLIENT_TEXT_LIMITS.billing_postal_code },
  billing_country: { maxLength: CLIENT_TEXT_LIMITS.billing_country },
  billing_currency: { maxLength: CLIENT_TEXT_LIMITS.billing_currency },
} satisfies Record<string, FormFieldDescriptor>;
