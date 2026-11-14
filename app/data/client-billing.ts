import type { Client } from './db.ts';

export interface Country {
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  name: string;
  /** ISO 4217 code commonly used for the country, or null when there is no clear default. */
  currency: string | null;
}

export interface Currency {
  /** ISO 4217 alpha code. */
  code: string;
  name: string;
}

/** Curated countries used for the billing address and currency suggestion. */
export const COUNTRIES: readonly Country[] = [
  { code: 'AR', name: 'Argentina', currency: 'ARS' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'CL', name: 'Chile', currency: 'CLP' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'CO', name: 'Colombia', currency: 'COP' },
  { code: 'HR', name: 'Croatia', currency: 'EUR' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'EG', name: 'Egypt', currency: 'EGP' },
  { code: 'EE', name: 'Estonia', currency: 'EUR' },
  { code: 'FI', name: 'Finland', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'GR', name: 'Greece', currency: 'EUR' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'HU', name: 'Hungary', currency: 'HUF' },
  { code: 'IS', name: 'Iceland', currency: 'ISK' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'IL', name: 'Israel', currency: 'ILS' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'JO', name: 'Jordan', currency: 'JOD' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD' },
  { code: 'LV', name: 'Latvia', currency: 'EUR' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'MT', name: 'Malta', currency: 'EUR' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'MA', name: 'Morocco', currency: 'MAD' },
  { code: 'NP', name: 'Nepal', currency: 'NPR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'OM', name: 'Oman', currency: 'OMR' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR' },
  { code: 'PE', name: 'Peru', currency: 'PEN' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'QA', name: 'Qatar', currency: 'QAR' },
  { code: 'RO', name: 'Romania', currency: 'RON' },
  { code: 'RU', name: 'Russia', currency: 'RUB' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'RS', name: 'Serbia', currency: 'RSD' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'KR', name: 'South Korea', currency: 'KRW' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS' },
  { code: 'TH', name: 'Thailand', currency: 'THB' },
  { code: 'TN', name: 'Tunisia', currency: 'TND' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY' },
  { code: 'UG', name: 'Uganda', currency: 'UGX' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'VN', name: 'Vietnam', currency: 'VND' },
];

/** Curated ISO 4217 currencies the billing form offers. */
export const CURRENCIES: readonly Currency[] = [
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound Sterling' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'ILS', name: 'Israeli New Shekel' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'ISK', name: 'Icelandic Krona' },
  { code: 'JOD', name: 'Jordanian Dinar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'RSD', name: 'Serbian Dinar' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'TND', name: 'Tunisian Dinar' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'ZAR', name: 'South African Rand' },
];

const countriesByCode = new Map(COUNTRIES.map((country) => [country.code, country]));
const currenciesByCode = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export type ClientBillingField =
  | 'billing_line1'
  | 'billing_locality'
  | 'billing_region'
  | 'billing_postal_code'
  | 'billing_country'
  | 'billing_currency';

export interface ClientBillingInput {
  billing_line1?: string;
  billing_locality?: string;
  billing_region?: string;
  billing_postal_code?: string;
  billing_country?: string;
  billing_currency?: string;
}

export interface ClientBillingFields {
  billing_line1: string | null;
  billing_locality: string | null;
  billing_region: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  billing_currency: string | null;
}

export interface ClientBillingIssue {
  field: ClientBillingField;
  message: string;
}

export type ClientBillingResult =
  | { ok: true; value: ClientBillingFields }
  | { ok: false; issues: ClientBillingIssue[] };

/** Columns the billing summary reads. */
export type ClientBillingView = Pick<
  Client,
  | 'billing_line1'
  | 'billing_locality'
  | 'billing_region'
  | 'billing_postal_code'
  | 'billing_country'
  | 'billing_currency'
>;

export function findCountry(code: string | null | undefined): Country | null {
  if (!code) return null;
  return countriesByCode.get(code.trim().toUpperCase()) ?? null;
}

export function countryName(code: string | null | undefined): string {
  return findCountry(code)?.name ?? (code?.trim().toUpperCase() ?? '');
}

export function currencyName(code: string | null | undefined): string | null {
  if (!code) return null;
  return currenciesByCode.get(code.trim().toUpperCase())?.name ?? null;
}

/**
 * The currency the billing country suggests, or null when the app has no suggestion.
 * Suggestions are display/edit conveniences only: nothing is ever converted.
 */
export function suggestCurrencyForCountry(code: string | null | undefined): string | null {
  return findCountry(code)?.currency ?? null;
}

/**
 * Parses the optional billing address and currency.
 *
 * The address exists only when at least one of its fields is non-blank; a present address
 * requires line 1 and country, while locality, region, and postal code stay optional.
 * A blank currency adopts the country suggestion. An explicit currency always wins.
 */
export function parseClientBilling(input: ClientBillingInput): ClientBillingResult {
  let line1 = clean(input.billing_line1);
  let locality = clean(input.billing_locality);
  let region = clean(input.billing_region);
  let postalCode = clean(input.billing_postal_code);
  let countryInput = clean(input.billing_country).toUpperCase();
  let currencyInput = clean(input.billing_currency).toUpperCase();

  let issues: ClientBillingIssue[] = [];
  let hasAddress = Boolean(line1 || locality || region || postalCode || countryInput);

  let country: string | null = null;
  if (countryInput) {
    if (countriesByCode.has(countryInput)) {
      country = countryInput;
    } else {
      issues.push({ field: 'billing_country', message: 'Choose a billing country.' });
    }
  }

  if (hasAddress) {
    if (!line1) {
      issues.push({ field: 'billing_line1', message: 'Enter billing address line 1.' });
    }
    if (!countryInput) {
      issues.push({ field: 'billing_country', message: 'Choose a billing country.' });
    }
  }

  let currency: string | null = null;
  if (currencyInput) {
    if (currenciesByCode.has(currencyInput)) {
      currency = currencyInput;
    } else {
      issues.push({
        field: 'billing_currency',
        message: 'Enter a 3-letter currency code, such as INR or USD.',
      });
    }
  } else if (country) {
    currency = suggestCurrencyForCountry(country);
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      billing_line1: hasAddress ? line1 || null : null,
      billing_locality: hasAddress ? locality || null : null,
      billing_region: hasAddress ? region || null : null,
      billing_postal_code: hasAddress ? postalCode || null : null,
      billing_country: hasAddress ? country : null,
      billing_currency: currency,
    },
  };
}

export function hasBillingAddress(client: ClientBillingView): boolean {
  return Boolean(
    client.billing_line1 ||
      client.billing_locality ||
      client.billing_region ||
      client.billing_postal_code ||
      client.billing_country,
  );
}

export function hasBillingDetails(client: ClientBillingView): boolean {
  return hasBillingAddress(client) || Boolean(client.billing_currency);
}

/** Address lines for display: line 1, then locality/region/postal, then the country name. */
export function billingAddressLines(client: ClientBillingView): string[] {
  let lines: string[] = [];
  if (client.billing_line1) lines.push(client.billing_line1);

  let regionAndPostal = [client.billing_region, client.billing_postal_code]
    .filter(Boolean)
    .join(' ');
  let localityLine = [client.billing_locality, regionAndPostal].filter(Boolean).join(', ');
  if (localityLine) lines.push(localityLine);

  if (client.billing_country) lines.push(countryName(client.billing_country));
  return lines;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}
