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
  tax_country: string;
  tax_type: string;
  tax_value: string;
  tax_state_code: string;
}

export function emptyClientFormValues(): ClientFormValues {
  return {
    type: '',
    legal_name: '',
    preferred_name: '',
    trading_name: '',
    industry: '',
    tax_country: '',
    tax_type: '',
    tax_value: '',
    tax_state_code: '',
  };
}

export function clientFormValuesOf(client: Client): ClientFormValues {
  return {
    type: client.type,
    legal_name: client.legal_name,
    preferred_name: client.preferred_name ?? '',
    trading_name: client.trading_name ?? '',
    industry: client.industry ?? '',
    tax_country: client.tax_country ?? '',
    tax_type: client.tax_type ?? '',
    tax_value: client.tax_value ?? '',
    tax_state_code: client.tax_state_code ?? '',
  };
}

export function readClientFormValues(formData: FormData): ClientFormValues {
  return {
    type: readText(formData, 'type'),
    legal_name: readText(formData, 'legal_name'),
    preferred_name: readText(formData, 'preferred_name'),
    trading_name: readText(formData, 'trading_name'),
    industry: readText(formData, 'industry'),
    tax_country: readText(formData, 'tax_country'),
    tax_type: readText(formData, 'tax_type'),
    tax_value: readText(formData, 'tax_value'),
    tax_state_code: readText(formData, 'tax_state_code'),
  };
}

export function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function issueFor(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}
