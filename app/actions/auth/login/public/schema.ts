import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/**
 * The login form, described once. The schema parses what the browser submits; the descriptor
 * table supplies the input attributes the login page renders. Credential verification itself is
 * the auth provider's domain — an unparsable submission simply fails to match any User.
 */
export const LoginForm = f.object({
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
});

export const loginFormFields = {
  email: { type: 'email', required: true, autoComplete: 'email' },
  password: { type: 'password', required: true, autoComplete: 'current-password' },
} satisfies Record<string, FormFieldDescriptor>;
