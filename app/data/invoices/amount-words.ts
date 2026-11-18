/**
 * Total-amount-in-words formatting for invoice PDFs. INR uses the Indian numbering system with
 * Rupees and Paise; every other ISO 4217 currency uses international (thousand-scale) numbering
 * in the currency's own minor units.
 */

import { currencyName } from '../client-billing.ts';
import { currencyMinorDigits } from './calculation.ts';

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen',
] as const;

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
] as const;

/** Indian scale words from kharab down; counts per group stay below one thousand. */
const INDIAN_GROUPS = [
  ['Kharab', 100_000_000_000n],
  ['Arab', 1_000_000_000n],
  ['Crore', 10_000_000n],
  ['Lakh', 100_000n],
  ['Thousand', 1_000n],
] as const;

/** International scale words from trillion down; counts per group stay below one thousand. */
const INTERNATIONAL_GROUPS = [
  ['Trillion', 1_000_000_000_000n],
  ['Billion', 1_000_000_000n],
  ['Million', 1_000_000n],
  ['Thousand', 1_000n],
] as const;

function belowOneHundred(value: number): string {
  if (value < 20) return ONES[value]!;
  let tens = TENS[Math.floor(value / 10)]!;
  let ones = value % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

function belowOneThousand(value: number): string {
  if (value < 100) return belowOneHundred(value);
  let hundreds = `${ONES[Math.floor(value / 100)]} Hundred`;
  let remainder = value % 100;
  return remainder === 0 ? hundreds : `${hundreds} ${belowOneHundred(remainder)}`;
}

function scaledGroupsWords(value: bigint, groups: typeof INDIAN_GROUPS | typeof INTERNATIONAL_GROUPS): string {
  if (value === 0n) return 'Zero';
  let remaining = value;
  let parts: string[] = [];
  for (let [label, size] of groups) {
    if (remaining < size) continue;
    let count = remaining / size;
    parts.push(`${belowOneThousand(Number(count))} ${label}`);
    remaining %= size;
  }
  if (remaining > 0n) parts.push(belowOneThousand(Number(remaining)));
  return parts.join(' ');
}

function indianRupeeWords(totalMinor: bigint): string {
  let whole = totalMinor / 100n;
  let paise = totalMinor % 100n;
  let parts = [`Rupees ${scaledGroupsWords(whole, INDIAN_GROUPS)}`];
  if (paise > 0n) parts.push(`Paise ${scaledGroupsWords(paise, INDIAN_GROUPS)}`);
  return `${parts.join(' and ')} Only`;
}

function internationalWords(totalMinor: bigint, currency: string): string {
  let digits = currencyMinorDigits(currency);
  let name = currencyName(currency) ?? currency.toUpperCase();
  let factor = 10n ** BigInt(digits);
  let whole = totalMinor / factor;
  let minor = totalMinor % factor;
  let amount = scaledGroupsWords(whole, INTERNATIONAL_GROUPS);
  if (digits === 0 || minor === 0n) return `${amount} ${name} Only`;
  return `${amount} and ${minor}/${10 ** digits} ${name} Only`;
}

/** Renders an invoice total in words, Indian-style for INR and international for other currencies. */
export function totalAmountInWords(totalMinor: bigint, currency: string): string {
  return currency.toUpperCase() === 'INR'
    ? indianRupeeWords(totalMinor)
    : internationalWords(totalMinor, currency);
}
