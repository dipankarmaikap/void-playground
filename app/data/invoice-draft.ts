import type { Issue } from 'remix/data-schema';

import { GSTIN_PATTERN, isIndiaCountry, normalizeTaxValue, UIN_PATTERN } from './client-tax.ts';
import { CLIENT_TEXT_LIMITS } from './client-text.ts';
import { findIndiaStateByCode } from './india-states.ts';
import { canonicalCountry, findCountry } from './client-billing.ts';
import {
  allocateProportionally,
  calculateLineAmountMinor,
  currencyMinorDigits,
  formatScaledDecimal,
  parseScaledDecimal,
  parseSignedScaledDecimal,
  percentOfMinor,
  PERCENT_MAX_SCALED,
  roundScaledToMinor,
  toExactMinorNumber,
  toExactSignedMinorNumber,
} from './invoice-calculation.ts';
import { ISO_4217_CURRENCY_MESSAGE, isIso4217Currency } from './currency.ts';
import { isValidIsoDate } from './invoice-dates.ts';
import { PAYMENT_TERMS } from './organization-invoicing.ts';

/** One service line's string values at the Draft parsing seam. */
export interface InvoiceDraftLineInput {
  description: string;
  sac: string;
  quantity: string;
  unit_price: string;
  discount_mode: string;
  discount_value: string;
  tax_treatment: string;
  gst_rate: string;
  foreign_tax_label: string;
  foreign_tax_mode: string;
  foreign_tax_value: string;
}

/** Editable invoice values, independent of the route's client-selection and display fields. */
export interface InvoiceDraftInput {
  currency: string;
  invoice_date: string;
  due_date: string;
  payment_term: string;
  custom_payment_terms: string;
  recipient_legal_name: string;
  recipient_billing_line1: string;
  recipient_billing_locality: string;
  recipient_billing_region: string;
  recipient_billing_postal_code: string;
  recipient_billing_country: string;
  recipient_tax_country: string;
  recipient_tax_type: string;
  recipient_tax_value: string;
  recipient_tax_state_code: string;
  payment_instructions: string;
  customer_notes: string;
  internal_note: string;
  invoice_discount_mode: string;
  invoice_discount_value: string;
  round_off: string;
  gst_mode: string;
  supply_type: string;
  place_of_supply_state_code: string;
  place_of_supply_country: string;
  recipient_gstin_applicable: string;
  reverse_charge: string;
  export_reference: string;
  lines: InvoiceDraftLineInput[];
}

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
  tax_treatment: 'taxable' | 'nil_rated' | 'exempt' | 'non_gst' | null;
  gst_rate: string | null;
  cgst_rate: string | null;
  sgst_rate: string | null;
  igst_rate: string | null;
  cgst_amount_minor: number;
  sgst_amount_minor: number;
  igst_amount_minor: number;
  foreign_tax_label: string | null;
  foreign_tax_mode: 'percent' | 'fixed' | null;
  foreign_tax_rate: string | null;
  foreign_tax_amount_minor: number;
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
  gst_mode: 'none' | 'india_gst' | 'foreign_manual';
  supply_type: 'domestic' | 'export_lut' | 'export_igst' | null;
  place_of_supply_state_code: string | null;
  place_of_supply_state_name: string | null;
  place_of_supply_country: string | null;
  recipient_gstin_applicable: boolean;
  reverse_charge: boolean;
  export_reference: string | null;
  payment_instructions: string | null;
  customer_notes: string | null;
  internal_note: string | null;
  subtotal_minor: number;
  line_discount_total_minor: number;
  invoice_discount_mode: string | null;
  invoice_discount_value: string | null;
  invoice_discount_minor: number;
  net_subtotal_minor: number;
  tax_total_minor: number;
  round_off_minor: number;
  total_minor: number;
  lines: InvoiceLineChanges[];
}

export type InvoiceDraftResult =
  | { ok: true; value: InvoiceDraftChanges }
  | { ok: false; issues: Issue[] };

export interface InvoiceDraftTaxConfig {
  gstRegistered: boolean;
  gstStateCode: string | null;
  gstRatePresets: readonly string[];
}

function isChecked(value: string): boolean {
  return ['on', 'true', '1', 'yes'].includes(value.trim().toLowerCase());
}

function formatHalfRate(rateScaled: bigint): string {
  let fivePlaceScaled = rateScaled * 5n;
  let whole = fivePlaceScaled / 100_000n;
  let fraction = (fivePlaceScaled % 100_000n).toString().padStart(5, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

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
export function parseInvoiceDraft(
  form: InvoiceDraftInput,
  taxConfig: InvoiceDraftTaxConfig = {
    gstRegistered: false,
    gstStateCode: null,
    gstRatePresets: [],
  },
): InvoiceDraftResult {
  let issues: Issue[] = [];
  let push = (field: string, message: string) => issues.push({ message, path: [field] });

  let legalName = form.recipient_legal_name.trim();
  if (!legalName) push('recipient_legal_name', 'Enter the recipient legal name.');
  for (let [field, max] of Object.entries(RECIPIENT_LIMITS)) {
    if (form[field as keyof InvoiceDraftInput].length > max) {
      push(field, `${field.replace(/_/g, ' ')} must be ${max} characters or fewer.`);
    }
  }

  let currency = form.currency.trim().toUpperCase();
  if (!isIso4217Currency(currency)) {
    push('currency', ISO_4217_CURRENCY_MESSAGE);
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

  let gstMode = form.gst_mode.trim() || 'none';
  if (gstMode !== 'none' && gstMode !== 'india_gst' && gstMode !== 'foreign_manual') {
    push('gst_mode', 'Choose a valid invoice tax mode.');
  }
  if (gstMode === 'india_gst' && !taxConfig.gstRegistered) {
    push('gst_mode', 'Indian GST is available only when your Organization has GST registration enabled.');
  }
  if (gstMode === 'india_gst' && taxConfig.gstRegistered && !findIndiaStateByCode(taxConfig.gstStateCode ?? '')) {
    push('gst_mode', 'Your Organization must have a valid GST State/UT configured before using Indian GST.');
  }
  let supplyType = form.supply_type.trim() || 'domestic';
  if (
    gstMode === 'india_gst' &&
    !['domestic', 'export_lut', 'export_igst'].includes(supplyType)
  ) {
    push('supply_type', 'Choose a valid GST supply classification.');
  }
  if (
    gstMode !== 'india_gst' &&
    (supplyType === 'export_lut' || supplyType === 'export_igst' || form.export_reference.trim())
  ) {
    push('supply_type', 'Export details require Indian GST mode.');
  }
  let placeStateCode = form.place_of_supply_state_code.trim();
  let placeState =
    gstMode === 'india_gst' && supplyType === 'domestic'
      ? findIndiaStateByCode(placeStateCode)
      : undefined;
  if (gstMode === 'india_gst' && supplyType === 'domestic' && !placeState) {
    push('place_of_supply_state_code', 'Choose a valid Place of Supply State or UT.');
  }
  let placeCountry = canonicalCountry(form.place_of_supply_country);
  let exportCountry = form.place_of_supply_country.trim()
    ? findCountry(form.place_of_supply_country)
    : null;
  if (gstMode === 'india_gst' && supplyType !== 'domestic') {
    if (!exportCountry || exportCountry.code === 'IN') {
      push('place_of_supply_country', 'Choose a country outside India for an export supply.');
    }
  } else if (form.place_of_supply_country.trim()) {
    push('place_of_supply_country', 'Place of Supply country is available only for exports.');
  }
  let exportReference = optional(form.export_reference);
  if (form.export_reference.length > 200) {
    push('export_reference', 'Export reference must be 200 characters or fewer.');
  }
  if (exportReference && gstMode === 'india_gst' && supplyType === 'domestic') {
    push('export_reference', 'Export reference requires an export supply classification.');
  }
  let reverseCharge = isChecked(form.reverse_charge);
  if (reverseCharge && gstMode !== 'india_gst') {
    push('reverse_charge', 'Reverse charge is available only on Indian GST invoices.');
  }
  let recipientGstinApplicable = isChecked(form.recipient_gstin_applicable);
  if (recipientGstinApplicable && gstMode !== 'india_gst') {
    push('recipient_gstin_applicable', 'Recipient GSTIN applicability is available only on GST invoices.');
  } else if (recipientGstinApplicable) {
    let taxType = form.recipient_tax_type.trim().toLowerCase();
    let taxValue = normalizeTaxValue(form.recipient_tax_value);
    let validGstin = taxType === 'gstin' && GSTIN_PATTERN.test(taxValue);
    let validUin = taxType === 'uin' && UIN_PATTERN.test(taxValue);
    if (!isIndiaCountry(form.recipient_tax_country) || (!validGstin && !validUin)) {
      push(
        'recipient_tax_value',
        'Enter a valid 15-character Indian GSTIN or UIN when recipient GSTIN is applicable.',
      );
    }
  }

  let optionalText: Array<[keyof InvoiceDraftInput, number, string]> = [
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
  let calculationCurrency = isIso4217Currency(currency) ? currency : 'INR';

  form.lines.forEach((line, index) => {
    let description = line.description.trim();
    let sac = line.sac.trim();
    let quantityRaw = line.quantity.trim();
    let priceRaw = line.unit_price.trim();
    let isBlank =
      !description &&
      !sac &&
      !quantityRaw &&
    !priceRaw &&
      !line.discount_mode.trim() &&
      !line.discount_value.trim() &&
      !line.tax_treatment.trim() &&
      !line.gst_rate.trim() &&
      !line.foreign_tax_label.trim() &&
      !line.foreign_tax_mode.trim() &&
      !line.foreign_tax_value.trim();
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

    let treatment = line.tax_treatment.trim();
    let parsedTreatment: InvoiceLineChanges['tax_treatment'] = null;
    let parsedRate: string | null = null;
    let parsedForeignLabel: string | null = null;
    let parsedForeignMode: InvoiceLineChanges['foreign_tax_mode'] = null;
    let parsedForeignRate: string | null = null;
    let parsedForeignFixedMinor = 0n;
    let hasForeignInput = Boolean(
      line.foreign_tax_label.trim() ||
        line.foreign_tax_mode.trim() ||
        line.foreign_tax_value.trim(),
    );
    if (gstMode === 'india_gst') {
      if (hasForeignInput) {
        lineIssue(
          'foreign_tax_label',
          'An invoice cannot combine Indian GST and manual foreign tax.',
        );
      }
      if (!['taxable', 'nil_rated', 'exempt', 'non_gst'].includes(treatment)) {
        lineIssue('tax_treatment', 'Choose a GST treatment for this service line.');
      } else {
        parsedTreatment = treatment as NonNullable<InvoiceLineChanges['tax_treatment']>;
      }
      if (treatment === 'taxable') {
        let rateInput = line.gst_rate.trim();
        if (supplyType !== 'export_lut' || rateInput) {
          let rateScaled = parseScaledDecimal(rateInput);
          let isPreset = taxConfig.gstRatePresets.some((presetRate) => {
            let presetScaled = parseScaledDecimal(presetRate);
            return presetScaled != null && presetScaled === rateScaled;
          });
          if (rateScaled == null || rateScaled > PERCENT_MAX_SCALED || !isPreset) {
            lineIssue('gst_rate', 'Choose a GST rate preset configured for your Organization.');
          } else {
            parsedRate = formatScaledDecimal(rateScaled);
          }
        }
      }
    } else {
      if (treatment || line.gst_rate.trim()) {
        lineIssue('tax_treatment', 'GST line treatments require Indian GST mode.');
      }
      if (gstMode === 'foreign_manual' && hasForeignInput) {
        let label = line.foreign_tax_label.trim();
        if (!label) {
          lineIssue('foreign_tax_label', 'Enter a label for the manual foreign tax.');
        } else if (label.length > 80) {
          lineIssue('foreign_tax_label', 'Manual tax labels must be 80 characters or fewer.');
        } else {
          parsedForeignLabel = label;
        }

        let mode = line.foreign_tax_mode.trim();
        let valueRaw = line.foreign_tax_value.trim();
        if (mode !== 'percent' && mode !== 'fixed') {
          lineIssue('foreign_tax_mode', 'Choose a percentage rate or fixed tax amount.');
        } else if (!valueRaw) {
          lineIssue('foreign_tax_value', 'Enter the manual foreign tax value.');
        } else {
          let scaled = parseScaledDecimal(valueRaw);
          if (scaled == null) {
            lineIssue(
              'foreign_tax_value',
              'Enter a non-negative manual tax value with at most 4 decimal places.',
            );
          } else if (mode === 'percent' && scaled > PERCENT_MAX_SCALED) {
            lineIssue('foreign_tax_value', 'A manual foreign tax percentage cannot exceed 100%.');
          } else if (mode === 'percent') {
            parsedForeignMode = 'percent';
            parsedForeignRate = formatScaledDecimal(scaled);
          } else {
            let fixedMinor = roundScaledToMinor(scaled, calculationCurrency);
            if (toExactMinorNumber(fixedMinor) == null) {
              lineIssue('foreign_tax_value', 'The manual foreign tax amount is too large to store exactly.');
            } else {
              parsedForeignMode = 'fixed';
              parsedForeignFixedMinor = fixedMinor;
            }
          }
        }
      } else if (hasForeignInput) {
        lineIssue('foreign_tax_label', 'Manual foreign tax requires the Manual foreign tax mode.');
      }
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
          tax_treatment: parsedTreatment,
          gst_rate: parsedRate,
          cgst_rate: null,
          sgst_rate: null,
          igst_rate: null,
          cgst_amount_minor: 0,
          sgst_amount_minor: 0,
          igst_amount_minor: 0,
          foreign_tax_label: parsedForeignLabel,
          foreign_tax_mode: parsedForeignMode,
          foreign_tax_rate: parsedForeignRate,
          foreign_tax_amount_minor: toExactMinorNumber(parsedForeignFixedMinor) ?? 0,
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

  let netSubtotalMinor = postLineSubtotal - invoiceDiscountMinor;
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
  let expectedRoundOffMinor =
    nearestWholeCurrencyUnitMinor(netSubtotalMinor, calculationCurrency) - netSubtotalMinor;
  if (roundOffRaw && roundOffScaled != null && roundOffMinor !== expectedRoundOffMinor) {
    push(
      'round_off',
      'Enter the adjustment that rounds the net total to the nearest whole currency unit (ties away from zero).',
    );
  }

  if (lines.length === 0 && !hasRangeIssue) {
    push('lines', 'Add at least one service line.');
  }
  let subtotal = toExactMinorNumber(subtotalMinor);
  let lineDiscountTotal = toExactMinorNumber(lineDiscountTotalMinor);
  let netSubtotal = toExactMinorNumber(netSubtotalMinor);
  let invoiceDiscountAmount = toExactMinorNumber(invoiceDiscountMinor);
  let preTaxTotalMinor = netSubtotalMinor + roundOffMinor;
  let preTaxTotal = toExactMinorNumber(preTaxTotalMinor);
  if (
    subtotal == null ||
    lineDiscountTotal == null ||
    netSubtotal == null ||
    invoiceDiscountAmount == null
  ) {
    push('total', 'The invoice total is too large to store exactly.');
  }
  if (preTaxTotalMinor < 0n) {
    push('round_off', 'Round-off cannot make the total negative.');
  } else if (preTaxTotal == null) {
    push('total', 'The invoice total is too large to store exactly.');
  }

  if (issues.length > 0) return { ok: false, issues };

  let allocation = allocateProportionally(invoiceDiscountMinor, linePostValues);
  lines.forEach((line, index) => {
    let allocated = allocation[index];
    line.allocated_invoice_discount_minor = toExactMinorNumber(allocated)!;
    line.net_minor -= Number(allocated);
  });

  let taxTotalMinor = 0n;
  if (gstMode === 'india_gst' && supplyType === 'export_lut') {
    // LUT/Bond exports disclose taxable value with a zero IGST rate and no IGST amount charged.
    for (let line of lines) {
      if (line.tax_treatment === 'taxable') line.igst_rate = '0';
    }
  } else if (gstMode === 'india_gst' && (placeState || supplyType === 'export_igst') && taxConfig.gstStateCode) {
    for (let line of lines) {
      if (line.tax_treatment !== 'taxable' || !line.gst_rate) continue;
      let rateScaled = parseScaledDecimal(line.gst_rate);
      if (rateScaled == null) continue;
      let lineTax = percentOfMinor(BigInt(line.net_minor), rateScaled);
      if (supplyType === 'domestic' && taxConfig.gstStateCode === placeState?.code) {
        let cgstAmount = (lineTax + 1n) / 2n;
        let sgstAmount = lineTax / 2n;
        let cgstNumber = toExactMinorNumber(cgstAmount);
        let sgstNumber = toExactMinorNumber(sgstAmount);
        if (cgstNumber == null || sgstNumber == null) {
          push('total', 'The invoice tax total is too large to store exactly.');
          continue;
        }
        line.cgst_rate = formatHalfRate(rateScaled);
        line.sgst_rate = formatHalfRate(rateScaled);
        line.cgst_amount_minor = cgstNumber;
        line.sgst_amount_minor = sgstNumber;
        taxTotalMinor += cgstAmount + sgstAmount;
      } else {
        let igstNumber = toExactMinorNumber(lineTax);
        if (igstNumber == null) {
          push('total', 'The invoice tax total is too large to store exactly.');
          continue;
        }
        line.igst_rate = line.gst_rate;
        line.igst_amount_minor = igstNumber;
        taxTotalMinor += lineTax;
      }
    }
  } else if (gstMode === 'foreign_manual') {
    for (let line of lines) {
      if (!line.foreign_tax_mode) continue;
      if (line.foreign_tax_mode === 'percent' && line.foreign_tax_rate) {
        let rateScaled = parseScaledDecimal(line.foreign_tax_rate);
        if (rateScaled != null) {
          let amount = percentOfMinor(BigInt(line.net_minor), rateScaled);
          let number = toExactMinorNumber(amount);
          if (number == null) {
            push('total', 'The invoice tax total is too large to store exactly.');
          } else {
            line.foreign_tax_amount_minor = number;
            taxTotalMinor += amount;
          }
        }
      } else {
        taxTotalMinor += BigInt(line.foreign_tax_amount_minor);
      }
    }
  }
  let taxTotal = toExactMinorNumber(taxTotalMinor);
  if (taxTotal == null) {
    push('total', 'The invoice tax total is too large to store exactly.');
  }
  let totalMinor =
    netSubtotalMinor + (reverseCharge ? 0n : taxTotalMinor) + roundOffMinor;
  let total = toExactMinorNumber(totalMinor);
  if (totalMinor < 0n) {
    push('round_off', 'Round-off cannot make the total negative.');
  } else if (total == null) {
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
      gst_mode: gstMode as InvoiceDraftChanges['gst_mode'],
      supply_type: gstMode === 'india_gst' ? (supplyType as InvoiceDraftChanges['supply_type']) : null,
      place_of_supply_state_code: gstMode === 'india_gst' && supplyType === 'domestic' ? placeState?.code ?? null : null,
      place_of_supply_state_name: gstMode === 'india_gst' && supplyType === 'domestic' ? placeState?.name ?? null : null,
      place_of_supply_country:
        gstMode === 'india_gst' && supplyType !== 'domestic' ? placeCountry : null,
      recipient_gstin_applicable: gstMode === 'india_gst' && recipientGstinApplicable,
      reverse_charge: gstMode === 'india_gst' && reverseCharge,
      export_reference: gstMode === 'india_gst' && supplyType !== 'domestic' ? exportReference : null,
      payment_instructions: optional(form.payment_instructions),
      customer_notes: optional(form.customer_notes),
      internal_note: optional(form.internal_note),
      subtotal_minor: subtotal!,
      line_discount_total_minor: lineDiscountTotal!,
      invoice_discount_mode: invoiceDiscount?.mode ?? null,
      invoice_discount_value: invoiceDiscount?.value ?? null,
      invoice_discount_minor: invoiceDiscountAmount!,
      net_subtotal_minor: netSubtotal!,
      tax_total_minor: taxTotal!,
      round_off_minor: roundOffAmount!,
      total_minor: total!,
      lines,
    },
  };
}

/**
 * Rounds a signed minor-unit total to the nearest whole currency unit, with exact halfway amounts
 * rounded away from zero. The adjustment itself is kept in minor units.
 */
function nearestWholeCurrencyUnitMinor(amount: bigint, currency: string): bigint {
  let unit = 10n ** BigInt(currencyMinorDigits(currency));
  let negative = amount < 0n;
  let magnitude = negative ? -amount : amount;
  let rounded = ((magnitude + unit / 2n) / unit) * unit;
  return negative ? -rounded : rounded;
}
