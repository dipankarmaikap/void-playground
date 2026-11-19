import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { formFieldAttributes } from '../../../../../ui/public/form-field.ts';
import {
  RefundForm,
  RefundVoidForm,
  REFUND_REFERENCE_MAX_LENGTH,
  REFUND_VOID_REASON_MAX_LENGTH,
  refundFormFields,
  refundValuesOf,
} from './schema.ts';

describe('refund form schema', () => {
  it('parses a submitted refund', () => {
    let formData = new FormData();
    formData.set('amount', '500.00');
    formData.set('refund_date', '2026-11-19');
    formData.set('refund_method', 'bank_transfer');
    formData.set('reference', 'RRN-9');

    let values = refundValuesOf(formData);
    assert.deepEqual(values, {
      amount: '500.00',
      refund_date: '2026-11-19',
      refund_method: 'bank_transfer',
      reference: 'RRN-9',
    });
  });

  it('defaults missing fields so validation rejects them explicitly', () => {
    let values = refundValuesOf(new FormData());
    assert.deepEqual(values, {
      amount: '',
      refund_date: '',
      refund_method: '',
      reference: '',
    });
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(RefundForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(refundFormFields).sort());
    }
  });

  it('derives the browser attributes the refund form renders', () => {
    let amount = formFieldAttributes(refundFormFields.amount);
    assert.equal(amount.type, 'number');
    assert.equal(amount.required, true);

    assert.deepEqual(formFieldAttributes(refundFormFields.refund_date), {
      type: 'date',
      required: true,
    });
    assert.equal(formFieldAttributes(refundFormFields.reference).maxLength, REFUND_REFERENCE_MAX_LENGTH);
    assert.equal('type' in formFieldAttributes(refundFormFields.refund_method), false);
  });

  it('parses the refund void reason with its bounds', () => {
    let formData = new FormData();
    formData.set('reason', 'Duplicate refund');

    let parsed = s.parseSafe(RefundVoidForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.reason, 'Duplicate refund');
    }
    assert.equal(REFUND_VOID_REASON_MAX_LENGTH, 1000);
  });
});
