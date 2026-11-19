import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { formFieldAttributes } from './form-field.ts';

describe('formFieldAttributes', () => {
  it('derives browser input attributes from a field descriptor', () => {
    assert.deepEqual(formFieldAttributes({ type: 'email', required: true, autoComplete: 'email' }), {
      type: 'email',
      required: true,
      autoComplete: 'email',
    });
  });

  it('omits attributes the descriptor leaves unset', () => {
    assert.deepEqual(formFieldAttributes({ maxLength: 40 }), { type: 'text', maxLength: 40 });
    assert.deepEqual(formFieldAttributes({ control: 'select', required: true }), {
      required: true,
    });
    assert.deepEqual(formFieldAttributes({ control: 'hidden' }), {});
  });

  it('marks a field with a validation issue as aria-invalid', () => {
    let attributes = formFieldAttributes(
      { type: 'password', required: true, minLength: 8 },
      { message: 'Must be at least 8 characters', path: ['password'] },
    );
    assert.equal(attributes['aria-invalid'], true);
  });

  it('keeps a valid field out of the aria-invalid state', () => {
    let attributes = formFieldAttributes({ type: 'text' });
    assert.equal('aria-invalid' in attributes, false);
  });
});
