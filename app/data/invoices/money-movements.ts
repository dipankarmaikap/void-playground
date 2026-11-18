import { currencyMinorDigits, MAX_EXACT_MINOR_UNITS } from './calculation.ts';

/** The seven payment rails shared by invoice payments and refunds. */
export const INVOICE_MONEY_MOVEMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque_demand_draft', label: 'Cheque / Demand Draft' },
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
  { value: 'international_wire', label: 'International Wire / Remittance' },
  { value: 'other', label: 'Other' },
] as const;

export type InvoiceMoneyMovementMethod = (typeof INVOICE_MONEY_MOVEMENT_METHODS)[number]['value'];

export function isInvoiceMoneyMovementMethod(value: string): value is InvoiceMoneyMovementMethod {
  return INVOICE_MONEY_MOVEMENT_METHODS.some((method) => method.value === value);
}

export function invoiceMoneyMovementMethodLabel(value: string): string {
  return INVOICE_MONEY_MOVEMENT_METHODS.find((method) => method.value === value)?.label ?? value;
}

/** Parses an exact amount in the invoice currency's minor-unit precision. */
export function parseMoneyMovementAmount(value: string, currency: string): number | null {
  let match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || match[1].length > 16) return null;

  let digits = currencyMinorDigits(currency);
  let fraction = match[2] ?? '';
  if (fraction.length > digits) return null;

  let amount =
    BigInt(match[1]) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  return amount <= MAX_EXACT_MINOR_UNITS ? Number(amount) : null;
}
