import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import type { FormFieldDescriptor } from '../../../../ui/public/form-field.ts';

/**
 * Builds the void-reason form schema and field descriptor shared by the payment and refund void
 * actions. The two forms keep their own exported names and their own reason-length constant; only
 * the identical construction is shared.
 */
export function voidReasonForm(maxLength: number) {
  return {
    schema: f.object({
      reason: f.field(s.defaulted(s.string(), '')),
    }),
    fields: {
      reason: { control: 'textarea', required: true, maxLength },
    } satisfies Record<string, FormFieldDescriptor>,
  };
}
