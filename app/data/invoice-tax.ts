import type { InvoiceLine } from './db.ts';
import { formatMoney } from './invoice-calculation.ts';

export interface GroupedInvoiceTax {
  label: string;
  amountMinor: bigint;
  formattedAmount: string;
}

/** Groups persisted line tax amounts by component and selected rate for Draft summaries. */
export function groupedInvoiceTaxes(
  lines: readonly InvoiceLine[],
  currency: string,
): GroupedInvoiceTax[] {
  let totals = new Map<string, bigint>();
  for (let line of lines) {
    for (let [component, rate, amount] of [
      ['CGST', line.cgst_rate, line.cgst_amount_minor],
      ['SGST', line.sgst_rate, line.sgst_amount_minor],
      ['IGST', line.igst_rate, line.igst_amount_minor],
    ] as const) {
      if (!rate) continue;
      let label = `${component} @ ${rate}%`;
      totals.set(label, (totals.get(label) ?? 0n) + BigInt(amount));
    }
  }
  return [...totals].map(([label, amountMinor]) => ({
    label,
    amountMinor,
    formattedAmount: formatMoney(amountMinor, currency),
  }));
}
