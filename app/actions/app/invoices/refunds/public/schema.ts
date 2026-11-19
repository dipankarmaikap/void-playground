import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import { voidReasonForm } from '../../public/void-reason-form.ts';
import type { FormFieldDescriptor } from '../../../../../ui/public/form-field.ts';

/** Longest refund reference the form accepts; the schema's bound and the browser share it. */
export const REFUND_REFERENCE_MAX_LENGTH = 200;

/** Longest void reason the form accepts; the controller check and the browser share it. */
export const REFUND_VOID_REASON_MAX_LENGTH = 1000;

/** The refund form, described once. Amount and date rules depend on the invoice's currency and
 * state, so they stay with the controller; the schema types the submitted shape. */
export const RefundForm = f.object({
  amount: f.field(s.defaulted(s.string(), '')),
  refund_date: f.field(s.defaulted(s.string(), '')),
  refund_method: f.field(s.defaulted(s.string(), '')),
  reference: f.field(s.defaulted(s.string(), '')),
});

export const refundFormFields = {
  amount: { type: 'number', required: true },
  refund_date: { type: 'date', required: true },
  refund_method: { control: 'select', required: true },
  reference: { maxLength: REFUND_REFERENCE_MAX_LENGTH },
} satisfies Record<string, FormFieldDescriptor>;

/** The refund void form, described once. */
const voidReason = voidReasonForm(REFUND_VOID_REASON_MAX_LENGTH);

export const RefundVoidForm = voidReason.schema;

export const refundVoidFormFields = voidReason.fields;

/** Reads a refund submission, failing closed to blank values if it cannot be read as text. */
export function refundValuesOf(formData: FormData) {
  let parsed = s.parseSafe(RefundForm, formData);
  return parsed.success
    ? parsed.value
    : { amount: '', refund_date: '', refund_method: '', reference: '' };
}
