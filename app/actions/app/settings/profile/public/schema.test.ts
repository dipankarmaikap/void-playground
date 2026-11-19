import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { DISPLAY_NAME_MAX_LENGTH } from '../../../../../config.ts';
import { formFieldAttributes } from '../../../../../ui/public/form-field.ts';
import {
  DisplayNameForm,
  OrganizationNameForm,
  displayNameFormFields,
  organizationNameFormFields,
} from './schema.ts';

describe('profile settings form schemas', () => {
  it('parses a submitted organization name', () => {
    let formData = new FormData();
    formData.set('organization_name', '  Lovelace Analytics  ');

    let parsed = s.parseSafe(OrganizationNameForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, { organization_name: '  Lovelace Analytics  ' });
    }
  });

  it('parses a submitted display name', () => {
    let formData = new FormData();
    formData.set('display_name', 'Ada Lovelace');

    let parsed = s.parseSafe(DisplayNameForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.value, { display_name: 'Ada Lovelace' });
    }
  });

  it('defaults missing fields to empty strings so the domain parsers reject them', () => {
    let organizationName = s.parseSafe(OrganizationNameForm, new FormData());
    assert.equal(organizationName.success, true);
    if (organizationName.success) {
      assert.equal(organizationName.value.organization_name, '');
    }

    let displayName = s.parseSafe(DisplayNameForm, new FormData());
    assert.equal(displayName.success, true);
    if (displayName.success) {
      assert.equal(displayName.value.display_name, '');
    }
  });

  it('describes exactly the fields each schema parses', () => {
    let organizationName = s.parseSafe(OrganizationNameForm, new FormData());
    if (organizationName.success) {
      assert.deepEqual(
        Object.keys(organizationName.value).sort(),
        Object.keys(organizationNameFormFields).sort(),
      );
    }
    let displayName = s.parseSafe(DisplayNameForm, new FormData());
    if (displayName.success) {
      assert.deepEqual(
        Object.keys(displayName.value).sort(),
        Object.keys(displayNameFormFields).sort(),
      );
    }
  });

  it('derives the browser attributes the profile forms render', () => {
    assert.deepEqual(formFieldAttributes(organizationNameFormFields.organization_name), {
      type: 'text',
      required: true,
      autoComplete: 'organization',
    });
    assert.deepEqual(formFieldAttributes(displayNameFormFields.display_name), {
      type: 'text',
      maxLength: DISPLAY_NAME_MAX_LENGTH,
      autoComplete: 'nickname',
    });
  });
});
