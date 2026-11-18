import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import type { InvoiceDraftInput, InvoiceDraftLineInput, InvoiceDraftResult } from './invoice-draft.ts';
import { parseInvoiceDraft } from './invoice-draft.ts';
import { ISO_4217_CURRENCY_MESSAGE } from './currency.ts';

function draftLine(overrides: Partial<InvoiceDraftLineInput> = {}): InvoiceDraftLineInput {
  return {
    description: 'Consulting services',
    sac: '998313',
    quantity: '1.5',
    unit_price: '100.0000',
    discount_mode: '',
    discount_value: '',
    tax_treatment: '',
    gst_rate: '',
    foreign_tax_label: '',
    foreign_tax_mode: '',
    foreign_tax_value: '',
    ...overrides,
  };
}

function draft(overrides: Partial<InvoiceDraftInput> = {}): InvoiceDraftInput {
  return {
    currency: 'INR',
    invoice_date: '2026-11-19',
    due_date: '2026-11-19',
    payment_term: 'due_on_receipt',
    custom_payment_terms: '',
    recipient_legal_name: 'Draft Recipient',
    recipient_billing_line1: '1 Draft Street',
    recipient_billing_locality: 'Bengaluru',
    recipient_billing_region: 'Karnataka',
    recipient_billing_postal_code: '560001',
    recipient_billing_country: 'IN',
    recipient_tax_country: 'IN',
    recipient_tax_type: 'gstin',
    recipient_tax_value: '27AAPCS2319F1Z5',
    recipient_tax_state_code: '27',
    payment_instructions: '',
    customer_notes: '',
    internal_note: '',
    invoice_discount_mode: '',
    invoice_discount_value: '',
    round_off: '',
    gst_mode: '',
    supply_type: '',
    place_of_supply_state_code: '',
    place_of_supply_country: '',
    recipient_gstin_applicable: '',
    reverse_charge: '',
    export_reference: '',
    lines: [draftLine()],
    ...overrides,
  };
}

function expectInvalid(form: InvoiceDraftInput): Extract<InvoiceDraftResult, { ok: false }> {
  let result = parseInvoiceDraft(form);
  assert.equal(result.ok, false, `expected issues, got ${JSON.stringify(result)}`);
  return result;
}

function issueMessages(result: Extract<InvoiceDraftResult, { ok: false }>, path: string[]): string[] {
  return result.issues
    .filter((issue) => (issue.path ?? []).join('.') === path.join('.'))
    .map((issue) => issue.message);
}

describe('invoice draft amount parsing', () => {
  it('computes line and invoice amounts from a decimal quantity and price', () => {
    // 1.5 × 100.0000 = 150.00 INR = 15000 minor units.
    let result = parseInvoiceDraft(draft());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    let line = result.value.lines[0];
    assert.equal(line.amount_minor, 15000);
    assert.equal(line.net_minor, 15000);
    assert.equal(result.value.subtotal_minor, 15000);
    assert.equal(result.value.net_subtotal_minor, 15000);
    assert.equal(result.value.tax_total_minor, 0);
    assert.equal(result.value.total_minor, 15000);
  });

  it('rounds a sub-minor product half-up at the currency precision', () => {
    // 1.25 × 10.10 = 12.625 INR, which rounds half-up to 12.63 = 1263 minor units.
    let result = parseInvoiceDraft(
      draft({ lines: [draftLine({ quantity: '1.25', unit_price: '10.10' })] }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.lines[0].amount_minor, 1263);
    assert.equal(result.value.total_minor, 1263);
  });

  it('rounds a sub-minor product down when below the halfway point', () => {
    // 1 × 0.124 = 0.124 INR, which truncates down to 0.12 = 12 minor units.
    let result = parseInvoiceDraft(
      draft({ lines: [draftLine({ quantity: '1', unit_price: '0.124' })] }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.lines[0].amount_minor, 12);
  });

  it('keeps zero-decimal currency amounts in whole units', () => {
    // JPY has no minor unit: 1 × 2.5 = 2.5 yen, which rounds half-up to 3 whole yen.
    let result = parseInvoiceDraft(
      draft({
        currency: 'JPY',
        lines: [
          draftLine({ quantity: '1', unit_price: '2.5' }),
          draftLine({ quantity: '2', unit_price: '123.5', sac: '', description: 'Support' }),
        ],
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.lines[0].amount_minor, 3);
    // 2 × 123.5 = 247.0 yen exactly.
    assert.equal(result.value.lines[1].amount_minor, 247);
    assert.equal(result.value.subtotal_minor, 250);
    assert.equal(result.value.total_minor, 250);
  });

  it('keeps three-decimal currency amounts at their minor precision', () => {
    // KWD has three minor digits: 2 × 1.2345 = 2.4690 KWD = 2469 fils, no rounding needed.
    let result = parseInvoiceDraft(
      draft({
        currency: 'KWD',
        lines: [draftLine({ quantity: '2', unit_price: '1.2345' })],
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.lines[0].amount_minor, 2469);
    assert.equal(result.value.total_minor, 2469);
  });

  it('totals multiple lines with a percentage line discount', () => {
    let result = parseInvoiceDraft(
      draft({
        lines: [
          draftLine({
            quantity: '1',
            unit_price: '100',
            discount_mode: 'percent',
            discount_value: '10',
          }),
          draftLine({
            quantity: '2',
            unit_price: '50.25',
            description: 'Support retainer',
            sac: '',
          }),
        ],
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    let [first, second] = result.value.lines;
    // 1 × 100 = 100.00 INR; 10% of it is 10.00, leaving a net of 90.00.
    assert.equal(first.amount_minor, 10000);
    assert.equal(first.line_discount_minor, 1000);
    assert.equal(first.net_minor, 9000);
    // 2 × 50.25 = 100.50 INR with no discount.
    assert.equal(second.amount_minor, 10050);
    assert.equal(second.net_minor, 10050);
    assert.equal(result.value.subtotal_minor, 20050);
    assert.equal(result.value.line_discount_total_minor, 1000);
    assert.equal(result.value.net_subtotal_minor, 19050);
    assert.equal(result.value.total_minor, 19050);
  });

  it('rejects zero, negative, and over-precise quantities', () => {
    for (let quantity of ['0', '-1.5', '1.12345']) {
      let result = expectInvalid(draft({ lines: [draftLine({ quantity })] }));
      let messages = issueMessages(result, ['lines', '0', 'quantity']);
      assert.ok(
        messages.includes('Enter a positive quantity with at most 4 decimal places.'),
        `quantity ${quantity}: expected a quantity issue, got ${JSON.stringify(result.issues)}`,
      );
    }
  });

  it('rejects malformed and over-precise unit prices', () => {
    for (let unit_price of ['abc', '12.34567', '-5']) {
      let result = expectInvalid(draft({ lines: [draftLine({ unit_price })] }));
      let messages = issueMessages(result, ['lines', '0', 'unit_price']);
      assert.ok(
        messages.includes('Enter a non-negative unit price with at most 4 decimal places.'),
        `unit price ${unit_price}: expected a unit price issue, got ${JSON.stringify(result.issues)}`,
      );
    }
  });

  it('requires at least one service line', () => {
    let result = expectInvalid(draft({ lines: [draftLine(blankLine())] }));
    let messages = issueMessages(result, ['lines']);
    assert.ok(messages.includes('Add at least one service line.'));
  });

  it('rejects a currency that is not an ISO 4217 code', () => {
    let result = expectInvalid(draft({ currency: 'XYZ' }));
    let messages = issueMessages(result, ['currency']);
    assert.ok(messages.includes(ISO_4217_CURRENCY_MESSAGE));
  });

  it('rejects a line amount outside the storable range', () => {
    // 9999999999 × 9999999999 INR is far beyond the exactly-storable minor-unit maximum.
    let result = expectInvalid(
      draft({
        lines: [draftLine({ quantity: '9999999999', unit_price: '9999999999' })],
      }),
    );
    let messages = issueMessages(result, ['lines', '0', 'amount']);
    assert.ok(
      messages.includes('This line amount is too large to store exactly. Reduce the quantity or unit price.'),
      `expected a line range issue, got ${JSON.stringify(result.issues)}`,
    );
  });

  it('rejects a total outside the storable range even when each line fits', () => {
    // Each line is 50000000000000.00 INR = 5e15 minor units, individually storable, but the
    // three-line subtotal of 1.5e16 exceeds the exactly-storable minor-unit maximum.
    let lines = [1, 2, 3].map((index) =>
      draftLine({
        quantity: '1',
        unit_price: '50000000000000',
        description: `Service ${index}`,
        sac: '',
      }),
    );
    let result = expectInvalid(draft({ lines }));
    let messages = issueMessages(result, ['total']);
    assert.ok(
      messages.includes('The invoice total is too large to store exactly.'),
      `expected a total range issue, got ${JSON.stringify(result.issues)}`,
    );
  });
});

function blankLine(): InvoiceDraftLineInput {
  return {
    description: '',
    sac: '',
    quantity: '',
    unit_price: '',
    discount_mode: '',
    discount_value: '',
    tax_treatment: '',
    gst_rate: '',
    foreign_tax_label: '',
    foreign_tax_mode: '',
    foreign_tax_value: '',
  };
}
