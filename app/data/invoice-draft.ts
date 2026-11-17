import type { Issue } from 'remix/data-schema';

import { isIndiaCountry, normalizeTaxValue } from './client-tax.ts';
import { CLIENT_TEXT_LIMITS } from './client-text.ts';
import { findIndiaStateByCode } from './india-states.ts';
import { canonicalCountry } from './client-billing.ts';
import {
  calculateLineAmountMinor,
  formatScaledDecimal,
  parseScaledDecimal,
  toExactMinorNumber,
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
  let subtotalMinor = 0n;
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
        subtotalMinor += amount;
        lines.push({
          position: lines.length,
          description,
          sac: optional(sac),
          quantity: formatScaledDecimal(quantity),
          unit_price: formatScaledDecimal(unitPrice),
          amount_minor: amountMinor,
        });
      }
    }
  });

  if (lines.length === 0 && !hasRangeIssue) {
    push('lines', 'Add at least one service line.');
  }
  let subtotal = toExactMinorNumber(subtotalMinor);
  if (subtotal == null) {
    push('total', 'The invoice total is too large to store exactly.');
  }

  if (issues.length > 0) return { ok: false, issues };

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
      total_minor: subtotal!,
      lines,
    },
  };
}
