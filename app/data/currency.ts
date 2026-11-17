const ISO_4217_CURRENCY_CODES = new Set(Intl.supportedValuesOf('currency'));

export const ISO_4217_CURRENCY_MESSAGE =
  'Enter a valid 3-letter ISO 4217 currency code, such as INR or USD.';

/** Whether a value is an uppercase currency code supported by the runtime's ISO 4217 data. */
export function isIso4217Currency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value) && ISO_4217_CURRENCY_CODES.has(value);
}
