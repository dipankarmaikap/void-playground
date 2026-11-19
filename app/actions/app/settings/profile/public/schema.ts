import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import { DISPLAY_NAME_MAX_LENGTH } from '../../../../../config.ts';
import type { FormFieldDescriptor } from '../../../../../ui/public/form-field.ts';

/**
 * The two Profile settings forms, described once. The Organization-name form and the
 * display-name form submit to the same action; the schema types what each submits and the
 * descriptor table supplies the input attributes the profile page renders.
 */
export const OrganizationNameForm = f.object({
  organization_name: f.field(s.defaulted(s.string(), '')),
});

export const organizationNameFormFields = {
  organization_name: { required: true, autoComplete: 'organization' },
} satisfies Record<string, FormFieldDescriptor>;

export const DisplayNameForm = f.object({
  display_name: f.field(s.defaulted(s.string(), '')),
});

export const displayNameFormFields = {
  display_name: { maxLength: DISPLAY_NAME_MAX_LENGTH, autoComplete: 'nickname' },
} satisfies Record<string, FormFieldDescriptor>;
