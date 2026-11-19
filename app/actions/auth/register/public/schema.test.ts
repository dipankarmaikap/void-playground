import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { DISPLAY_NAME_MAX_LENGTH } from '../../../../config.ts';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { RegisterForm, REGISTER_PASSWORD_MIN_LENGTH, registerFormFields } from './schema.ts';

describe('register form schema', () => {
  it('parses a complete registration submission', () => {
    let formData = new FormData();
    formData.set('email', 'owner@example.com');
    formData.set('organization_name', 'Lovelace Analytics');
    formData.set('display_name', 'Ada Lovelace');
    formData.set('password', 'password123');

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, {
        email: 'owner@example.com',
        organization_name: 'Lovelace Analytics',
        display_name: 'Ada Lovelace',
        password: 'password123',
      });
    }
  });

  it('defaults the optional name fields when they are omitted', () => {
    let formData = new FormData();
    formData.set('email', 'owner@example.com');
    formData.set('organization_name', 'Studio');
    formData.set('password', 'password123');

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.organization_name, 'Studio');
      assert.equal(parsed.value.display_name, '');
    }
  });

  it('rejects an invalid email address', () => {
    let formData = new FormData();
    formData.set('email', 'not-an-email');
    formData.set('organization_name', 'Valid Studio');
    formData.set('password', 'password123');

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.issues[0]?.message ?? '', /email/i);
      assert.deepEqual(parsed.issues[0]?.path, ['email']);
    }
  });

  it('rejects a password shorter than the enforced minimum', () => {
    let formData = new FormData();
    formData.set('email', 'owner@example.com');
    formData.set('organization_name', 'Valid Studio');
    formData.set('password', 'a'.repeat(REGISTER_PASSWORD_MIN_LENGTH - 1));

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.deepEqual(parsed.issues[0]?.path, ['password']);
    }
  });

  it('accepts a password at the enforced minimum', () => {
    let formData = new FormData();
    formData.set('email', 'owner@example.com');
    formData.set('organization_name', 'Valid Studio');
    formData.set('password', 'a'.repeat(REGISTER_PASSWORD_MIN_LENGTH));

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, true);
  });

  it('describes exactly the fields the schema parses', () => {
    let formData = new FormData();
    formData.set('email', 'owner@example.com');
    formData.set('organization_name', 'Studio');
    formData.set('password', 'password123');

    let parsed = s.parseSafe(RegisterForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(registerFormFields).sort());
    }
  });

  it('derives browser attributes that match the schema rules', () => {
    let password = formFieldAttributes(registerFormFields.password);
    assert.equal(password.type, 'password');
    assert.equal(password.required, true);
    // The browser minlength must equal the minimum the schema enforces server-side.
    assert.equal(password.minLength, REGISTER_PASSWORD_MIN_LENGTH);

    let email = formFieldAttributes(registerFormFields.email);
    assert.equal(email.type, 'email');
    assert.equal(email.required, true);

    let displayName = formFieldAttributes(registerFormFields.display_name);
    assert.equal(displayName.maxLength, DISPLAY_NAME_MAX_LENGTH);
    assert.equal('required' in displayName, false);
  });
});
