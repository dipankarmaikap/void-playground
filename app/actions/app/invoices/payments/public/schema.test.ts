import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { formFieldAttributes } from '../../../../../ui/public/form-field.ts';
import {
  PaymentForm,
  PaymentVoidForm,
  PAYMENT_REFERENCE_MAX_LENGTH,
  PAYMENT_VOID_REASON_MAX_LENGTH,
  paymentFormFields,
  paymentValuesOf,
} from './schema.ts';

describe('payment form schema', () => {
  it('parses a submitted payment', () => {
    let formData = new FormData();
    formData.set('amount', '1500.00');
    formData.set('payment_date', '2026-11-19');
    formData.set('payment_method', 'upi');
    formData.set('reference', 'UTR-123');

    let values = paymentValuesOf(formData);
    assert.deepEqual(values, {
      amount: '1500.00',
      payment_date: '2026-11-19',
      payment_method: 'upi',
      reference: 'UTR-123',
    });
  });

  it('defaults missing fields so validation rejects them explicitly', () => {
    let values = paymentValuesOf(new FormData());
    assert.deepEqual(values, {
      amount: '',
      payment_date: '',
      payment_method: '',
      reference: '',
    });
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(PaymentForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(paymentFormFields).sort());
    }
  });

  it('derives the browser attributes the payment form renders', () => {
    let amount = formFieldAttributes(paymentFormFields.amount);
    assert.equal(amount.type, 'number');
    assert.equal(amount.required, true);

    assert.deepEqual(formFieldAttributes(paymentFormFields.payment_date), {
      type: 'date',
      required: true,
    });
    assert.equal(formFieldAttributes(paymentFormFields.reference).maxLength, PAYMENT_REFERENCE_MAX_LENGTH);
    assert.equal('type' in formFieldAttributes(paymentFormFields.payment_method), false);
  });

  it('parses the payment void reason with its bounds', () => {
    let formData = new FormData();
    formData.set('reason', 'Entered twice');

    let parsed = s.parseSafe(PaymentVoidForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.reason, 'Entered twice');
    }
    assert.equal(PAYMENT_VOID_REASON_MAX_LENGTH, 1000);
  });
});
