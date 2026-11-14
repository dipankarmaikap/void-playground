import type { Issue } from 'remix/data-schema';

import type { Client } from '../../../data/db.ts';

/**
 * The string values a Client form submits.
 * Kept separate from stored rows so validation failures can re-render exactly what was typed.
 */
export interface ClientFormValues {
  type: string;
  legal_name: string;
  preferred_name: string;
  trading_name: string;
  industry: string;
  email: string;
  phone: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  /** Tax identifier fields were added in #9; one optional identifier per Client. */
  tax_country: string;
  tax_type: string;
  tax_value: string;
  tax_state_code: string;
  /** Billing address and currency fields were added in #11; all optional per Client. */
  billing_line1: string;
  billing_locality: string;
  billing_region: string;
  billing_postal_code: string;
  billing_country: string;
  billing_currency: string;
}

export function emptyClientFormValues(): ClientFormValues {
  return {
    type: '',
    legal_name: '',
    preferred_name: '',
    trading_name: '',
    industry: '',
    email: '',
    phone: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    contact_phone: '',
    tax_country: '',
    tax_type: '',
    tax_value: '',
    tax_state_code: '',
    billing_line1: '',
    billing_locality: '',
    billing_region: '',
    billing_postal_code: '',
    billing_country: '',
    billing_currency: '',
  };
}

export function clientFormValuesOf(client: Client): ClientFormValues {
  return {
    type: client.type,
    legal_name: client.legal_name,
    preferred_name: client.preferred_name ?? '',
    trading_name: client.trading_name ?? '',
    industry: client.industry ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    contact_name: client.contact_name ?? '',
    contact_role: client.contact_role ?? '',
    contact_email: client.contact_email ?? '',
    contact_phone: client.contact_phone ?? '',
    tax_country: client.tax_country ?? '',
    tax_type: client.tax_type ?? '',
    tax_value: client.tax_value ?? '',
    tax_state_code: client.tax_state_code ?? '',
    billing_line1: client.billing_line1 ?? '',
    billing_locality: client.billing_locality ?? '',
    billing_region: client.billing_region ?? '',
    billing_postal_code: client.billing_postal_code ?? '',
    billing_country: client.billing_country ?? '',
    billing_currency: client.billing_currency ?? '',
  };
}

export function readClientFormValues(formData: FormData): ClientFormValues {
  return {
    type: readText(formData, 'type'),
    legal_name: readText(formData, 'legal_name'),
    preferred_name: readText(formData, 'preferred_name'),
    trading_name: readText(formData, 'trading_name'),
    industry: readText(formData, 'industry'),
    email: readText(formData, 'email'),
    phone: readText(formData, 'phone'),
    contact_name: readText(formData, 'contact_name'),
    contact_role: readText(formData, 'contact_role'),
    contact_email: readText(formData, 'contact_email'),
    contact_phone: readText(formData, 'contact_phone'),
    tax_country: readText(formData, 'tax_country'),
    tax_type: readText(formData, 'tax_type'),
    tax_value: readText(formData, 'tax_value'),
    tax_state_code: readText(formData, 'tax_state_code'),
    billing_line1: readText(formData, 'billing_line1'),
    billing_locality: readText(formData, 'billing_locality'),
    billing_region: readText(formData, 'billing_region'),
    billing_postal_code: readText(formData, 'billing_postal_code'),
    billing_country: readText(formData, 'billing_country'),
    billing_currency: readText(formData, 'billing_currency'),
  };
}

export function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function issueFor(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}
