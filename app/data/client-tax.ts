import { clientDisplayLabel } from './client-names.ts';
import { validateClientTextFields } from './client-text.ts';
import { clients, db } from './db.ts';
import type { Client } from './db.ts';
import { findIndiaStateByCode } from './india-states.ts';

export const INDIA_COUNTRY_CODE = 'IN';

export const TAX_TYPE_GSTIN = 'gstin';
export const TAX_TYPE_UIN = 'uin';

/** Standard 15-character GSTIN shape (format only; the checksum is not verified). */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** A UIN is 15 alphanumeric characters. */
export const UIN_PATTERN = /^[A-Z0-9]{15}$/;

const INDIA_COUNTRY_NAMES = new Set(['IN', 'IND', 'INDIA']);

export type ClientTaxField =
  | 'tax_country'
  | 'tax_type'
  | 'tax_value'
  | 'tax_state_name'
  | 'tax_state_code';

export interface ClientTaxInput {
  tax_country: string;
  tax_type: string;
  tax_value: string;
  /** The form posts the State/UT code; the matching name is stored alongside it. */
  tax_state_code: string;
}

export interface ClientTaxFields {
  tax_country: string | null;
  tax_type: string | null;
  tax_value: string | null;
  tax_state_name: string | null;
  tax_state_code: string | null;
}

export interface ClientTaxIssue {
  field: ClientTaxField;
  message: string;
}

export type ClientTaxResult =
  | { ok: true; value: ClientTaxFields }
  | { ok: false; issues: ClientTaxIssue[] };

/** True when the submitted country should use the India GSTIN/UIN fields. */
export function isIndiaCountry(country: string): boolean {
  return INDIA_COUNTRY_NAMES.has(country.trim().toUpperCase());
}

/** Tax identifier values compare case-insensitively, so always store the trimmed uppercase form. */
export function normalizeTaxValue(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * The familiar label for a stored identifier type: GSTIN and UIN keep their acronyms;
 * a generic type is shown as the User typed it.
 */
export function clientTaxTypeLabel(type: string | null): string {
  if (type === TAX_TYPE_GSTIN) return 'GSTIN';
  if (type === TAX_TYPE_UIN) return 'UIN';
  return type ?? '';
}

/**
 * Parses the single optional tax identifier on a Client.
 * Blank across every tax field means "not recorded" and clears the row's tax columns.
 * Only basic format checks run; no government service is contacted.
 */
export function parseClientTax(input: ClientTaxInput): ClientTaxResult {
  let lengthIssues = validateClientTextFields({
    tax_country: input.tax_country,
    tax_type: input.tax_type,
    tax_value: input.tax_value,
  });
  if (lengthIssues.length > 0) return { ok: false, issues: lengthIssues };

  let country = input.tax_country.trim();
  let type = input.tax_type.trim();
  let value = normalizeTaxValue(input.tax_value);
  let stateCode = input.tax_state_code.trim();

  if (!country && !type && !value && !stateCode) {
    return {
      ok: true,
      value: {
        tax_country: null,
        tax_type: null,
        tax_value: null,
        tax_state_name: null,
        tax_state_code: null,
      },
    };
  }

  let issues: ClientTaxIssue[] = [];

  if (!value) {
    issues.push({
      field: 'tax_value',
      message: 'Enter the tax identifier value, or clear the other tax details.',
    });
  }
  if (!country) {
    issues.push({
      field: 'tax_country',
      message: 'Enter the country for this tax identifier.',
    });
  }

  if (isIndiaCountry(country)) {
    let normalizedType = type.toLowerCase();
    let isGstin = normalizedType === TAX_TYPE_GSTIN;
    let isUin = normalizedType === TAX_TYPE_UIN;

    if (!isGstin && !isUin) {
      issues.push({
        field: 'tax_type',
        message: 'For an India tax identifier, use GSTIN or UIN.',
      });
    }

    let state = findIndiaStateByCode(stateCode);
    if (!state) {
      issues.push({
        field: 'tax_state_code',
        message: 'Choose the State or UT for this India tax identifier.',
      });
    }

    if (isGstin && value && !GSTIN_PATTERN.test(value)) {
      issues.push({
        field: 'tax_value',
        message: 'Enter a 15-character GSTIN, for example 27AAPCS2319F1Z5.',
      });
    }
    if (
      isGstin &&
      value &&
      GSTIN_PATTERN.test(value) &&
      state &&
      value.slice(0, 2) !== state.code
    ) {
      issues.push({
        field: 'tax_state_code',
        message: 'State or UT code must match the first two digits of the GSTIN.',
      });
    }
    if (isUin && value && !UIN_PATTERN.test(value)) {
      issues.push({
        field: 'tax_value',
        message: 'Enter a 15-character alphanumeric UIN.',
      });
    }

    if (issues.length > 0) return { ok: false, issues };

    return {
      ok: true,
      value: {
        tax_country: INDIA_COUNTRY_CODE,
        tax_type: normalizedType,
        tax_value: value,
        tax_state_name: state?.name ?? null,
        tax_state_code: state?.code ?? null,
      },
    };
  }

  if (!type) {
    issues.push({
      field: 'tax_type',
      message: 'Enter the identifier type, for example VAT or EIN.',
    });
  }
  if (stateCode) {
    issues.push({
      field: 'tax_state_code',
      message: 'A State or UT applies only to an India tax identifier.',
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      tax_country: country,
      tax_type: type,
      tax_value: value,
      tax_state_name: null,
      tax_state_code: null,
    },
  };
}

/**
 * Finds another Client that already uses the same normalized identifier value.
 * Duplicates are allowed; callers use this only to surface a non-blocking warning.
 */
export async function findClientWithTaxValue(
  organizationId: string,
  value: string,
  excludeClientId?: string,
): Promise<Client | null> {
  let normalized = normalizeTaxValue(value);
  if (!normalized) return null;

  let matches = await db.findMany(clients, {
    where: { organization_id: organizationId, tax_value: normalized },
  });
  return matches.find((client) => client.id !== excludeClientId) ?? null;
}

/** The non-blocking notice shown after saving an identifier another Client already uses. */
export function duplicateTaxWarning(value: string, duplicate: Client): string {
  return `Tax identifier ${normalizeTaxValue(value)} is already recorded on another client (${clientDisplayLabel(duplicate)}). It was saved anyway.`;
}
