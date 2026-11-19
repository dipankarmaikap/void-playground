import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { VerifyForm, verifyFormFields } from './schema.ts';

describe('verify form schema', () => {
  it('parses the submitted verification token', () => {
    let formData = new FormData();
    formData.set('token', 'token-value');

    let parsed = s.parseSafe(VerifyForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, { token: 'token-value' });
    }
  });

  it('defaults a missing token so the verification link fails closed', () => {
    let parsed = s.parseSafe(VerifyForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.token, '');
    }
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(VerifyForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(verifyFormFields).sort());
    }
  });
});
