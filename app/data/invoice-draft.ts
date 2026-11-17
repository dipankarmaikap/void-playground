import type { Issue } from 'remix/data-schema';

import { isIndiaCountry, normalizeTaxValue } from './client-tax.ts';
import { CLIENT_TEXT_LIMITS } from './client-text.ts';
import { findIndiaStateByCode } from './india-states.ts';
import { canonicalCountry } from './client-billing.ts';
import {
  allocateProportionally,
  calculateLineAmountMinor,
  formatScaledDecimal,
  parseScaledDecimal,
  parseSignedScaledDecimal,
  percentOfMinor,
  PERCENT_MAX_SCALED,
  roundScaledToMinor,
  toExactMinorNumber,
  toExactSignedMinorNumber,
} from './invoice-calculation.ts';
import { isValidIsoDate } from './invoice-dates.ts';
import { PAYMENT_TERMS } from './organization-invoicing.ts';
import type { InvoiceFormValues } from '../actions/app/invoices/form-values.ts';

export interface InvoiceLineChanges {
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
}

/** The invoice-row plus line-row changes a valid Draft form submission produces. */
export interface InvoiceDraftChanges {
  currency: string;
  invoice_date: string;
  due_date: string;
  payment_term: string;
  custom_payment_terms: string | null;
  recipient_legal_name: string;
  recipient_billing_line1: string | null;
  recipient_billing_locality: string | null;
  recipient_billing_region: string | null;
  recipient_billing_postal_code: string | null;
  recipient_billing_country: string | null;
  recipient_tax_country: string | null;
  recipient_tax_type: string | null;
  recipient_tax_value: string | null;
  recipient_tax_state_name: string | null;
  recipient_tax_state_code: string | null;
  payment_instructions: string | null;
  customer_notes: string | null;
  internal_note: string | null;
  subtotal_minor: number;
  line_discount_total_minor: number;
  invoice_discount_mode: string | null;
  invoice_discount_value: string | null;
  invoice_discount_minor: number;
  net_subtotal_minor: number;
  round_off_minor: number;
  total_minor: number;
  lines: InvoiceLineChanges[];
}

export type InvoiceDraftResult =
  | { ok: true; value: InvoiceDraftChanges }
  | { ok: false; issues: Issue[] };

const RECIPIENT_LIMITS: Record<string, number> = {
  recipient_legal_name: CLIENT_TEXT_LIMITS.legal_name,
  recipient_billing_line1: CLIENT_TEXT_LIMITS.billing_line1,
  recipient_billing_locality: CLIENT_TEXT_LIMITS.billing_locality,
  recipient_billing_region: CLIENT_TEXT_LIMITS.billing_region,
  recipient_billing_postal_code: CLIENT_TEXT_LIMITS.billing_postal_code,
  recipient_billing_country: CLIENT_TEXT_LIMITS.billing_country,
  recipient_tax_country: CLIENT_TEXT_LIMITS.tax_country,
  recipient_tax_type: CLIENT_TEXT_LIMITS.tax_type,
  recipient_tax_value: CLIENT_TEXT_LIMITS.tax_value,
};

const DESCRIPTION_MAX_LENGTH = 500;
const SAC_MAX_LENGTH = 64;

function optional(value: string): string | null {
  let trimmed = value.trim();
  return trimmed || null;
}

interface DiscountInput {
  mode: 'percent' | 'fixed';
  value: string;
  scaled: bigint;
}

/**
 * Parses one optional discount entry. A blank mode and value mean no discount; a percentage must
 * be between 0 and 100. Callers map `mode`/`value` issues to their own form field names.
 */
function parseDiscountInput(
  modeRaw: string,
  valueRaw: string,
  issue: (field: 'mode' | 'value', message: string) => void,
): DiscountInput | null | undefined {
  let mode = modeRaw.trim().toLowerCase();
  let raw = valueRaw.trim();
  if (!mode && !raw) return null;
  if (mode !== 'percent' && mode !== 'fixed') {
    issue('mode', 'Choose a valid discount type.');
    return undefined;
  }
  if (!raw) {
    issue('value', 'Enter a discount value.');
    return undefined;
  }
  let scaled = parseScaledDecimal(raw);
  if (scaled == null) {
    issue('value', 'Enter a non-negative discount with at most 4 decimal places.');
    return undefined;
  }
  if (mode === 'percent' && scaled > PERCENT_MAX_SCALED) {
    issue('value', 'A percentage discount cannot exceed 100%.');
    return undefined;
  }
  return { mode, value: formatScaledDecimal(scaled), scaled };
}

/**
 * Parses and validates a Draft form submission.
 *
 * Recipient address fields may be incomplete while work is in progress; only format and length are
 * checked. Lines are ignored when every field is blank, so a blank row removes a line. Amounts are
 * computed once, with BigInt arithmetic, at the selected currency's minor-unit precision.
 */
export function parseInvoiceDraft(form: InvoiceFormValues): InvoiceDraftResult {
  let issues: Issue[] = [];
  let push = (field: string, message: string) => issues.push({ message, path: [field] });

  let legalName = form.recipient_legal_name.trim();
  if (!legalName) push('recipient_legal_name', 'Enter the recipient legal name.');
  for (let [field, max] of Object.entries(RECIPIENT_LIMITS)) {
    if (form[field as keyof InvoiceFormValues].length > max) {
      push(field, `${field.replace(/_/g, ' ')} must be ${max} characters or fewer.`);
    }
  }

  let currency = form.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    push('currency', 'Enter a 3-letter currency code, such as INR or USD.');
  }

  let invoiceDate = form.invoice_date.trim();
  if (!isValidIsoDate(invoiceDate)) {
    push('invoice_date', 'Enter a valid invoice date.');
  }
  let dueDate = form.due_date.trim();
  if (!isValidIsoDate(dueDate)) {
    push('due_date', 'Enter a valid due date.');
  } else if (isValidIsoDate(invoiceDate) && dueDate < invoiceDate) {
    push('due_date', 'The due date cannot be earlier than the invoice date.');
  }

  let paymentTerm = form.payment_term.trim();
  if (!(PAYMENT_TERMS as readonly string[]).includes(paymentTerm)) {
    push('payment_term', 'Choose a valid payment term.');
  }

  let optionalText: Array<[keyof InvoiceFormValues, number, string]> = [
    ['custom_payment_terms', 200, 'Custom payment terms'],
    ['payment_instructions', 1000, 'Payment instructions'],
    ['customer_notes', 1000, 'Customer notes'],
    ['internal_note', 1000, 'Internal note'],
  ];
  for (let [field, max, label] of optionalText) {
    if (form[field].length > max) push(field, `${label} must be ${max} characters or fewer.`);
  }

  let lines: InvoiceLineChanges[] = [];
  let linePostValues: bigint[] = [];
  let subtotalMinor = 0n;
  let lineDiscountTotalMinor = 0n;
  let hasRangeIssue = false;
  let calculationCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'INR';

  form.lines.forEach((line, index) => {
    let description = line.description.trim();
    let sac = line.sac.trim();
    let quantityRaw = line.quantity.trim();
    let priceRaw = line.unit_price.trim();
    let isBlank = !description && !sac && !quantityRaw && !priceRaw;
    if (isBlank) return;

    let lineIssue = (field: string, message: string) =>
      issues.push({ message, path: ['lines', index, field] });

    if (!description) lineIssue('description', 'Enter a service description.');
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      lineIssue('description', `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`);
    }
    if (sac.length > SAC_MAX_LENGTH) {
      lineIssue('sac', `SAC must be ${SAC_MAX_LENGTH} characters or fewer.`);
    }

    let quantity = parseScaledDecimal(quantityRaw);
    if (quantity == null || quantity === 0n) {
      lineIssue('quantity', 'Enter a positive quantity with at most 4 decimal places.');
    }
    let unitPrice = parseScaledDecimal(priceRaw);
    if (unitPrice == null) {
      lineIssue('unit_price', 'Enter a non-negative unit price with at most 4 decimal places.');
    }
    let discount = parseDiscountInput(line.discount_mode, line.discount_value, (field, message) =>
      lineIssue(`discount_${field}`, message),
    );
    if (discount === undefined) return;

    if (quantity != null && quantity > 0n && unitPrice != null) {
      let amount = calculateLineAmountMinor(quantity, unitPrice, calculationCurrency);
      let amountMinor = toExactMinorNumber(amount);
      if (amountMinor == null) {
        hasRangeIssue = true;
        lineIssue(
          'amount',
          'This line amount is too large to store exactly. Reduce the quantity or unit price.',
        );
      } else {
        let lineDiscountMinor = 0n;
        if (discount?.mode === 'percent') {
          lineDiscountMinor = percentOfMinor(amount, discount.scaled);
        } else if (discount?.mode === 'fixed') {
          lineDiscountMinor = roundScaledToMinor(discount.scaled, calculationCurrency);
        }
        if (lineDiscountMinor > amount) {
          lineIssue('discount_value', 'The line discount cannot exceed the line amount.');
          return;
        }
        let net = amount - lineDiscountMinor;
        subtotalMinor += amount;
        lineDiscountTotalMinor += lineDiscountMinor;
        lines.push({
          position: lines.length,
          description,
          sac: optional(sac),
          quantity: formatScaledDecimal(quantity),
          unit_price: formatScaledDecimal(unitPrice),
          amount_minor: amountMinor,
          discount_mode: discount?.mode ?? null,
          discount_value: discount?.value ?? null,
          line_discount_minor: toExactMinorNumber(lineDiscountMinor)!,
          allocated_invoice_discount_minor: 0,
          net_minor: toExactMinorNumber(net)!,
        });
        linePostValues.push(net);
      }
    }
  });

  let invoiceDiscount = parseDiscountInput(
    form.invoice_discount_mode,
    form.invoice_discount_value,
    (field, message) => push(`invoice_discount_${field}`, message),
  );
  if (invoiceDiscount === undefined) invoiceDiscount = null;

  let postLineSubtotal = subtotalMinor - lineDiscountTotalMinor;
  let invoiceDiscountMinor = 0n;
  if (invoiceDiscount?.mode === 'percent') {
    invoiceDiscountMinor = percentOfMinor(postLineSubtotal, invoiceDiscount.scaled);
  } else if (invoiceDiscount?.mode === 'fixed') {
    invoiceDiscountMinor = roundScaledToMinor(invoiceDiscount.scaled, calculationCurrency);
  }
  if (invoiceDiscountMinor > postLineSubtotal) {
    push('invoice_discount_value', 'The invoice discount cannot exceed the post-discount subtotal.');
  }

  let roundOffRaw = form.round_off.trim();
  let roundOffScaled = roundOffRaw ? parseSignedScaledDecimal(roundOffRaw) : 0n;
  if (roundOffScaled == null) {
    push('round_off', 'Enter a signed round-off amount with at most 4 decimal places.');
  }
  let roundOffMinor =
    roundOffScaled == null ? 0n : roundScaledToMinor(roundOffScaled, calculationCurrency);
  let roundOffAmount = toExactSignedMinorNumber(roundOffMinor);
  if (roundOffAmount == null) {
    push('round_off', 'The round-off amount is too large to store exactly.');
  }

  if (lines.length === 0 && !hasRangeIssue) {
    push('lines', 'Add at least one service line.');
  }
  let subtotal = toExactMinorNumber(subtotalMinor);
  let lineDiscountTotal = toExactMinorNumber(lineDiscountTotalMinor);
  let netSubtotalMinor = postLineSubtotal - invoiceDiscountMinor;
  let netSubtotal = toExactMinorNumber(netSubtotalMinor);
  let invoiceDiscountAmount = toExactMinorNumber(invoiceDiscountMinor);
  let totalMinor = netSubtotalMinor + roundOffMinor;
  let total = toExactMinorNumber(totalMinor);
  if (
    subtotal == null ||
    lineDiscountTotal == null ||
    netSubtotal == null ||
    invoiceDiscountAmount == null
  ) {
    push('total', 'The invoice total is too large to store exactly.');
  }
  if (totalMinor < 0n) {
    push('round_off', 'Round-off cannot make the total negative.');
  } else if (total == null) {
    push('total', 'The invoice total is too large to store exactly.');
  }

  if (issues.length > 0) return { ok: false, issues };

  let allocation = allocateProportionally(invoiceDiscountMinor, linePostValues);
  lines.forEach((line, index) => {
    let allocated = allocation[index];
    line.allocated_invoice_discount_minor = toExactMinorNumber(allocated)!;
    line.net_minor -= Number(allocated);
  });

  let taxState = form.recipient_tax_state_code.trim();
  let taxCountry = optional(form.recipient_tax_country);
  // The hidden name is never trusted: resolve the canonical name from the State/UT code instead.
  let taxStateName =
    taxState && (!taxCountry || isIndiaCountry(taxCountry))
      ? (findIndiaStateByCode(taxState)?.name ?? null)
      : null;
  return {
    ok: true,
    value: {
      currency,
      invoice_date: invoiceDate,
      due_date: dueDate,
      payment_term: paymentTerm,
      custom_payment_terms: paymentTerm === 'custom' ? optional(form.custom_payment_terms) : null,
      recipient_legal_name: legalName,
      recipient_billing_line1: optional(form.recipient_billing_line1),
      recipient_billing_locality: optional(form.recipient_billing_locality),
      recipient_billing_region: optional(form.recipient_billing_region),
      recipient_billing_postal_code: optional(form.recipient_billing_postal_code),
      recipient_billing_country: form.recipient_billing_country.trim()
        ? canonicalCountry(form.recipient_billing_country)
        : null,
      recipient_tax_country: taxCountry,
      recipient_tax_type: optional(form.recipient_tax_type)?.toLowerCase() ?? null,
      recipient_tax_value: form.recipient_tax_value.trim()
        ? normalizeTaxValue(form.recipient_tax_value)
        : null,
      recipient_tax_state_name: taxStateName,
      recipient_tax_state_code: taxState || null,
      payment_instructions: optional(form.payment_instructions),
      customer_notes: optional(form.customer_notes),
      internal_note: optional(form.internal_note),
      subtotal_minor: subtotal!,
      line_discount_total_minor: lineDiscountTotal!,
      invoice_discount_mode: invoiceDiscount?.mode ?? null,
      invoice_discount_value: invoiceDiscount?.value ?? null,
      invoice_discount_minor: invoiceDiscountAmount!,
      net_subtotal_minor: netSubtotal!,
      round_off_minor: roundOffAmount!,
      total_minor: total!,
      lines,
    },
  };
}
