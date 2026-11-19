import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';
import * as checks from 'remix/data-schema/checks';

import { DISPLAY_NAME_MAX_LENGTH } from '../../../../config.ts';
import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/** Shortest password a registration accepts; the schema and the browser input share it. */
export const REGISTER_PASSWORD_MIN_LENGTH = 8;

/**
 * The registration form, described once. The schema owns the validation rules (email format,
 * password length); the descriptor table supplies the input attributes the register page renders.
 */
export const RegisterForm = f.object({
  email: f.field(s.string().pipe(checks.email())),
  organization_name: f.field(s.defaulted(s.string(), '')),
  display_name: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.string().pipe(checks.minLength(REGISTER_PASSWORD_MIN_LENGTH))),
});

export const registerFormFields = {
  email: { type: 'email', required: true, autoComplete: 'email' },
  organization_name: { required: true, autoComplete: 'organization' },
  display_name: { maxLength: DISPLAY_NAME_MAX_LENGTH, autoComplete: 'nickname' },
  password: {
    type: 'password',
    required: true,
    minLength: REGISTER_PASSWORD_MIN_LENGTH,
    autoComplete: 'new-password',
  },
} satisfies Record<string, FormFieldDescriptor>;
