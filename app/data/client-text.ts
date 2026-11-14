export const CLIENT_TEXT_LIMITS = {
  legal_name: 120,
  preferred_name: 120,
  trading_name: 120,
  industry: 120,
  email: 254,
  phone: 40,
  contact_name: 120,
  contact_role: 100,
  contact_email: 254,
  contact_phone: 40,
  tax_country: 100,
  tax_type: 40,
  tax_value: 128,
  billing_line1: 200,
  billing_locality: 100,
  billing_region: 100,
  billing_postal_code: 32,
  billing_country: 100,
  billing_currency: 3,
} as const;

export type ClientTextField = keyof typeof CLIENT_TEXT_LIMITS;

export const BILLING_CURRENCY_LENGTH_MESSAGE =
  'Enter a 3-letter currency code, such as INR or USD.';

const CLIENT_TEXT_LABELS: Record<ClientTextField, string> = {
  legal_name: 'Legal name',
  preferred_name: 'Preferred name',
  trading_name: 'Trading name',
  industry: 'Industry',
  email: 'Email',
  phone: 'Phone',
  contact_name: 'Contact name',
  contact_role: 'Contact role',
  contact_email: 'Contact email',
  contact_phone: 'Contact phone',
  tax_country: 'Tax identifier country',
  tax_type: 'Tax identifier type',
  tax_value: 'Tax identifier value',
  billing_line1: 'Billing address line 1',
  billing_locality: 'Billing locality or city',
  billing_region: 'Billing state or region',
  billing_postal_code: 'Billing postal code',
  billing_country: 'Billing country',
  billing_currency: 'Default billing currency',
};

export interface ClientTextIssue<Field extends ClientTextField = ClientTextField> {
  field: Field;
  message: string;
}

/** Rejects over-limit submitted values without trimming or truncating them. */
export function validateClientTextFields<const Field extends ClientTextField>(
  values: Partial<Record<Field, string>>,
): ClientTextIssue<Field>[] {
  let issues: ClientTextIssue<Field>[] = [];

  for (let field of Object.keys(values) as Field[]) {
    let value = values[field];
    let maxLength = CLIENT_TEXT_LIMITS[field];
    if (value != null && value.length > maxLength) {
      issues.push({
        field,
        message:
          field === 'billing_currency'
            ? BILLING_CURRENCY_LENGTH_MESSAGE
            : `${CLIENT_TEXT_LABELS[field]} must be ${maxLength} characters or fewer.`,
      });
    }
  }

  return issues;
}
