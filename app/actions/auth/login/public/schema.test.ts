import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { LoginForm, loginFormFields } from './schema.ts';

describe('login form schema', () => {
  it('parses submitted credentials as strings', () => {
    let formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'secret');

    let parsed = s.parseSafe(LoginForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, { email: 'user@example.com', password: 'secret' });
    }
  });

  it('defaults missing fields to empty strings so verification fails closed', () => {
    let parsed = s.parseSafe(LoginForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, { email: '', password: '' });
    }
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(LoginForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(loginFormFields).sort());
    }
  });

  it('drives email and password browser attributes from the schema module', () => {
    assert.deepEqual(formFieldAttributes(loginFormFields.email), {
      type: 'email',
      required: true,
      autoComplete: 'email',
    });
    assert.deepEqual(formFieldAttributes(loginFormFields.password), {
      type: 'password',
      required: true,
      autoComplete: 'current-password',
    });
  });
});
