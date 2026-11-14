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
}

export function emptyClientFormValues(): ClientFormValues {
  return { type: '', legal_name: '', preferred_name: '', trading_name: '', industry: '' };
}

export function clientFormValuesOf(client: Client): ClientFormValues {
  return {
    type: client.type,
    legal_name: client.legal_name,
    preferred_name: client.preferred_name ?? '',
    trading_name: client.trading_name ?? '',
    industry: client.industry ?? '',
  };
}

export function readClientFormValues(formData: FormData): ClientFormValues {
  return {
    type: readText(formData, 'type'),
    legal_name: readText(formData, 'legal_name'),
    preferred_name: readText(formData, 'preferred_name'),
    trading_name: readText(formData, 'trading_name'),
    industry: readText(formData, 'industry'),
  };
}

export function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function issueFor(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}
