import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { CLIENT_TEXT_LIMITS } from '../../../../data/client-text.ts';
import { CLIENT_NAME_MAX_LENGTH as NAME_MAX } from '../../../../data/client-names.ts';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { ClientForm, clientFormFields } from './schema.ts';

describe('client form schema', () => {
  it('parses every submitted Client form field', () => {
    let formData = new FormData();
    formData.set('type', 'business');
    formData.set('legal_name', 'Acme Pvt Ltd');
    formData.set('preferred_name', 'Acme');
    formData.set('trading_name', 'Acme Trading');
    formData.set('industry', 'Manufacturing');
    formData.set('email', 'billing@acme.example');
    formData.set('phone', '+91 98765 43210');
    formData.set('contact_name', 'Ada');
    formData.set('contact_role', 'Finance');
    formData.set('contact_email', 'ada@acme.example');
    formData.set('contact_phone', '+91 90000 00000');
    formData.set('tax_country', 'IN');
    formData.set('tax_type', 'GSTIN');
    formData.set('tax_value', '29ABCDE1234F1Z5');
    formData.set('tax_state_code', '29');
    formData.set('billing_line1', '12 MG Road');
    formData.set('billing_locality', 'Bengaluru');
    formData.set('billing_region', 'Karnataka');
    formData.set('billing_postal_code', '560001');
    formData.set('billing_country', 'India');
    formData.set('billing_currency', 'INR');

    let parsed = s.parseSafe(ClientForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.type, 'business');
      assert.equal(parsed.value.legal_name, 'Acme Pvt Ltd');
      assert.equal(parsed.value.contact_email, 'ada@acme.example');
      assert.equal(parsed.value.billing_currency, 'INR');
    }
  });

  it('defaults every field to an empty string so sections see complete values', () => {
    let parsed = s.parseSafe(ClientForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      for (let value of Object.values(parsed.value)) {
        assert.equal(value, '');
      }
    }
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(ClientForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(clientFormFields).sort());
    }
  });

  it('derives the browser attributes the Client form sections render', () => {
    let type = formFieldAttributes(clientFormFields.type);
    assert.equal(type.required, true);
    assert.equal('type' in type, false);

    let legalName = formFieldAttributes(clientFormFields.legal_name);
    assert.equal(legalName.required, true);
    assert.equal(legalName.maxLength, NAME_MAX);

    assert.deepEqual(formFieldAttributes(clientFormFields.email), {
      type: 'email',
      maxLength: CLIENT_TEXT_LIMITS.email,
    });
    assert.deepEqual(formFieldAttributes(clientFormFields.phone), {
      type: 'tel',
      maxLength: CLIENT_TEXT_LIMITS.phone,
    });
    assert.deepEqual(formFieldAttributes(clientFormFields.contact_email), {
      type: 'email',
      maxLength: CLIENT_TEXT_LIMITS.contact_email,
    });
    assert.equal(formFieldAttributes(clientFormFields.tax_value).maxLength, CLIENT_TEXT_LIMITS.tax_value);
    assert.equal(
      formFieldAttributes(clientFormFields.billing_currency).maxLength,
      CLIENT_TEXT_LIMITS.billing_currency,
    );
  });

  it('marks a field with an issue as aria-invalid', () => {
    let legalName = formFieldAttributes(
      clientFormFields.legal_name,
      { message: 'Enter the legal name.', path: ['legal_name'] },
    );
    assert.equal(legalName['aria-invalid'], true);
    assert.equal(CLIENT_TEXT_LIMITS.legal_name, NAME_MAX);
  });
});
