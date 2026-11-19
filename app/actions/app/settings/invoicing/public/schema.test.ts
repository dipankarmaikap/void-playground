import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { CLIENT_TEXT_LIMITS } from '../../../../../data/client-text.ts';
import {
  DEFAULT_CREDIT_NOTE_PREFIX,
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_PAYMENT_TERM,
  DEFAULT_STARTING_NUMBER,
} from '../../../../../data/organization/invoicing.ts';
import { formFieldAttributes } from '../../../../../ui/public/form-field.ts';
import {
  InvoicingForm,
  invoicingFormFields,
  invoicingValuesOf,
  PresetRateForm,
  presetFormFields,
  presetValuesOf,
} from './schema.ts';

describe('invoicing settings form schema', () => {
  it('parses a complete invoicing submission', () => {
    let formData = new FormData();
    formData.set('legal_name', 'Lovelace Analytics Pvt Ltd');
    formData.set('billing_email', 'billing@lovelace.example');
    formData.set('gst_registered', 'on');
    formData.set('default_currency', 'USD');
    formData.set('payment_term', 'net_15');
    formData.set('invoice_prefix', 'LA');
    formData.set('invoice_starting_number', '42');

    let values = invoicingValuesOf(formData);
    assert.equal(values.legal_name, 'Lovelace Analytics Pvt Ltd');
    assert.equal(values.billing_email, 'billing@lovelace.example');
    assert.equal(values.gst_registered, 'on');
    assert.equal(values.default_currency, 'USD');
    assert.equal(values.payment_term, 'net_15');
    assert.equal(values.invoice_prefix, 'LA');
    assert.equal(values.invoice_starting_number, '42');
  });

  it('fills the documented defaults when a control is omitted entirely', () => {
    let values = invoicingValuesOf(new FormData());
    assert.equal(values.default_currency, DEFAULT_CURRENCY);
    assert.equal(values.payment_term, DEFAULT_PAYMENT_TERM);
    assert.equal(values.invoice_prefix, DEFAULT_INVOICE_PREFIX);
    assert.equal(values.invoice_starting_number, String(DEFAULT_STARTING_NUMBER));
    assert.equal(values.credit_note_prefix, DEFAULT_CREDIT_NOTE_PREFIX);
    assert.equal(values.credit_note_starting_number, String(DEFAULT_STARTING_NUMBER));
  });

  it('keeps a submitted blank control blank so validation can reject it', () => {
    let formData = new FormData();
    formData.set('default_currency', '');

    let values = invoicingValuesOf(formData);
    assert.equal(values.default_currency, '');
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(InvoicingForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(invoicingFormFields).sort());
    }
  });

  it('derives the browser attributes the invoicing form renders', () => {
    assert.deepEqual(formFieldAttributes(invoicingFormFields.legal_name), {
      type: 'text',
      maxLength: CLIENT_TEXT_LIMITS.legal_name,
      autoComplete: 'organization',
    });
    assert.deepEqual(formFieldAttributes(invoicingFormFields.billing_email), {
      type: 'email',
      maxLength: CLIENT_TEXT_LIMITS.email,
      autoComplete: 'email',
    });
    assert.deepEqual(formFieldAttributes(invoicingFormFields.billing_phone), {
      type: 'tel',
      maxLength: CLIENT_TEXT_LIMITS.phone,
      autoComplete: 'tel',
    });
    assert.equal(formFieldAttributes(invoicingFormFields.pan).maxLength, 10);
    assert.equal(formFieldAttributes(invoicingFormFields.gstin).maxLength, 15);
    assert.equal('type' in formFieldAttributes(invoicingFormFields.gst_registered), false);
    assert.equal(formFieldAttributes(invoicingFormFields.default_currency).maxLength, 3);
    assert.equal('type' in formFieldAttributes(invoicingFormFields.payment_term), false);
    assert.equal(formFieldAttributes(invoicingFormFields.custom_payment_terms).maxLength, 200);
    assert.equal(formFieldAttributes(invoicingFormFields.invoice_prefix).maxLength, 12);
    assert.equal(formFieldAttributes(invoicingFormFields.signatory_name).maxLength, 120);
    assert.equal(
      formFieldAttributes(invoicingFormFields.signatory_designation).maxLength,
      100,
    );
  });

  it('parses a submitted GST rate preset', () => {
    let formData = new FormData();
    formData.set('rate', '12.5');
    formData.set('preset_id', 'preset-1');

    let preset = presetValuesOf(formData);
    assert.deepEqual(preset, { rate: '12.5', presetId: 'preset-1' });
    assert.deepEqual(presetValuesOf(new FormData()), { rate: '', presetId: '' });

    let parsed = s.parseSafe(PresetRateForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(presetFormFields).sort());
    }
  });
});
