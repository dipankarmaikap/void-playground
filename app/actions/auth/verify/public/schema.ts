import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/**
 * The email-verification form, described once. It submits only the hidden token the verify page
 * prefilled from the verified link; a missing or unparsable token fails the link check.
 */
export const VerifyForm = f.object({
  token: f.field(s.defaulted(s.string(), '')),
});

export const verifyFormFields = {
  token: { control: 'hidden' },
} satisfies Record<string, FormFieldDescriptor>;
