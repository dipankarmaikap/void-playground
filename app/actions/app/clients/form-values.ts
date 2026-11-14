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
  /**
   * Contact fields were added in #8. They stay optional on this shared interface so existing
   * sections that only produce identity values keep compiling; every page-level helper below
   * fills them in, and `readClientFormValues` always returns them.
   */
  email?: string;
  phone?: string;
  contact_name?: string;
  contact_role?: string;
  contact_email?: string;
  contact_phone?: string;
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
  };
}

export function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function issueFor(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}
