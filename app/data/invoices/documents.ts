import type { Invoice } from '../db.ts';

/**
 * An Invoice row without its private internal note, so it can never reach a client-facing
 * document. One neutral owner serves issuance snapshots, stored PDF artifacts, and the PDF
 * renderer — issuance must not depend on a renderer-specific module.
 */
export type InvoicePdfDocument = Omit<Invoice, 'internal_note'>;

/**
 * The stable line-value fields whose meaning matches between an Invoice service line and a
 * Credit Note reversal line. Each document keeps its own additions: the Invoice's narrowed
 * tax-treatment and foreign-tax-mode unions, and the Credit Note line's source
 * `invoice_line_id` identity with the broader copied tax-value strings.
 */
export interface LineValueFields {
  position: number;
  description: string;
  sac: string | null;
  quantity: string;
  unit_price: string;
  amount_minor: number;
  discount_mode: string | null;
  discount_value: string | null;
  line_discount_minor: number;
  allocated_invoice_discount_minor: number;
  net_minor: number;
  gst_rate: string | null;
  cgst_rate: string | null;
  sgst_rate: string | null;
  igst_rate: string | null;
  cgst_amount_minor: number;
  sgst_amount_minor: number;
  igst_amount_minor: number;
  foreign_tax_label: string | null;
  foreign_tax_rate: string | null;
  foreign_tax_amount_minor: number;
}
