/**
 * Exact decimal helpers for invoice lines. Quantities and unit prices are kept as canonical
 * decimal strings scaled to four places and converted to BigInt before arithmetic, so no IEEE 754
 * rounding ever reaches a stored amount. Currency precision is resolved from ISO 4217 metadata.
 */

/** Decimal places kept for quantities and unit prices. */
export const LINE_DECIMAL_PLACES = 4;
const LINE_SCALE = 10n ** BigInt(LINE_DECIMAL_PLACES);

/** ISO 4217 currencies with other than two minor units, used when Intl has no metadata. */
const ZERO_MINOR_UNITS = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_MINOR_UNITS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** The number of decimal places an ISO 4217 currency uses for its minor unit. */
export function currencyMinorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).resolvedOptions().minimumFractionDigits ?? 2;
  } catch {
    let code = currency.toUpperCase();
    if (ZERO_MINOR_UNITS.has(code)) return 0;
    if (THREE_MINOR_UNITS.has(code)) return 3;
    return 2;
  }
}

/** Parses a non-negative decimal with at most four places into a fixed-point BigInt. */
export function parseScaledDecimal(raw: string): bigint | null {
  let value = raw.trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) return null;
  let [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * LINE_SCALE + BigInt(fraction.padEnd(LINE_DECIMAL_PLACES, '0'));
}

/** Renders a fixed-point BigInt back to its canonical four-place-or-fewer decimal string. */
export function formatScaledDecimal(scaled: bigint): string {
  let whole = scaled / LINE_SCALE;
  let fraction = scaled % LINE_SCALE;
  if (fraction === 0n) return whole.toString();
  let text = fraction.toString().padStart(LINE_DECIMAL_PLACES, '0').replace(/0+$/, '');
  return `${whole}.${text}`;
}

/**
 * Multiplies a scaled quantity by a scaled unit price and rounds half-up to the currency's minor
 * unit. The product carries eight decimal places; dividing by 10^(8 - minorDigits) yields minor
 * units exactly.
 */
export function calculateLineAmountMinor(
  quantity: bigint,
  unitPrice: bigint,
  currency: string,
): bigint {
  let digits = currencyMinorDigits(currency);
  let divisor = 10n ** BigInt(LINE_DECIMAL_PLACES * 2 - digits);
  let product = quantity * unitPrice;
  return (product + divisor / 2n) / divisor;
}

/** Formats a minor-unit amount with the currency's own precision, without floating-point math. */
export function formatMoney(minor: bigint, currency: string): string {
  let digits = currencyMinorDigits(currency);
  let factor = 10n ** BigInt(digits);
  let whole = minor / factor;
  let fraction = minor % factor;
  let grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (digits === 0) return `${grouped} ${currency}`;
  let fractionText = fraction.toString().padStart(digits, '0');
  return `${grouped}.${fractionText} ${currency}`;
}
