import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import type { FormFieldDescriptor } from '../../../../../ui/public/form-field.ts';

/** Longest payment reference the form accepts; the schema's bound and the browser share it. */
export const PAYMENT_REFERENCE_MAX_LENGTH = 200;

/** Longest void reason the form accepts; the controller check and the browser share it. */
export const PAYMENT_VOID_REASON_MAX_LENGTH = 1000;

/** The payment form, described once. Amount and date rules depend on the invoice's currency and
 * state, so they stay with the controller; the schema types the submitted shape. */
export const PaymentForm = f.object({
  amount: f.field(s.defaulted(s.string(), '')),
  payment_date: f.field(s.defaulted(s.string(), '')),
  payment_method: f.field(s.defaulted(s.string(), '')),
  reference: f.field(s.defaulted(s.string(), '')),
});

export const paymentFormFields = {
  amount: { type: 'number', required: true },
  payment_date: { type: 'date', required: true },
  payment_method: { control: 'select', required: true },
  reference: { maxLength: PAYMENT_REFERENCE_MAX_LENGTH },
} satisfies Record<string, FormFieldDescriptor>;

/** The payment void form, described once. */
export const PaymentVoidForm = f.object({
  reason: f.field(s.defaulted(s.string(), '')),
});

export const paymentVoidFormFields = {
  reason: { control: 'textarea', required: true, maxLength: PAYMENT_VOID_REASON_MAX_LENGTH },
} satisfies Record<string, FormFieldDescriptor>;

/** Reads a payment submission, failing closed to blank values if it cannot be read as text. */
export function paymentValuesOf(formData: FormData) {
  let parsed = s.parseSafe(PaymentForm, formData);
  return parsed.success
    ? parsed.value
    : { amount: '', payment_date: '', payment_method: '', reference: '' };
}
