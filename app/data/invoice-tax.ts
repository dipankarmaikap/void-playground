import type { InvoiceLine } from './db.ts';
import { formatMoney } from './invoice-calculation.ts';

export interface GroupedInvoiceTax {
  label: string;
  amountMinor: bigint;
  formattedAmount: string;
}

/** Formats persisted CGST, SGST, and IGST amounts consistently across Draft views. */
export function invoiceLineGstComponents(
  line: InvoiceLine,
  currency: string,
): string[] {
  return [
    line.cgst_rate != null
      ? `CGST @ ${line.cgst_rate}%: ${formatMoney(BigInt(line.cgst_amount_minor), currency)}`
      : null,
    line.sgst_rate != null
      ? `SGST @ ${line.sgst_rate}%: ${formatMoney(BigInt(line.sgst_amount_minor), currency)}`
      : null,
    line.igst_rate != null
      ? `IGST @ ${line.igst_rate}%: ${formatMoney(BigInt(line.igst_amount_minor), currency)}`
      : null,
  ].filter((value): value is string => value != null);
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
    if (line.foreign_tax_label && line.foreign_tax_mode) {
      let label =
        line.foreign_tax_mode === 'percent' && line.foreign_tax_rate
          ? `${line.foreign_tax_label} @ ${line.foreign_tax_rate}%`
          : line.foreign_tax_label;
      totals.set(
        label,
        (totals.get(label) ?? 0n) + BigInt(line.foreign_tax_amount_minor),
      );
    }
  }
  return [...totals].map(([label, amountMinor]) => ({
    label,
    amountMinor,
    formattedAmount: formatMoney(amountMinor, currency),
  }));
}
