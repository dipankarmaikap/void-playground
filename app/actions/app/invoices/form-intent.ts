import type { InvoiceFormValues, InvoiceLineFormValue } from './form-values.ts';

/** Smallest number of line rows shown so there is always space to type a new line. */
export const MIN_VISIBLE_LINES = 3;

/** Identifies the no-JS button that re-renders the form with one extra blank line. */
export function isAddLineIntent(formData: FormData): boolean {
  return formData.get('_intent') === 'add_line';
}

/** Returns the submitted snapshot with one more blank line, without saving anything. */
export function withAdditionalLine(values: InvoiceFormValues): InvoiceFormValues {
  let blank: InvoiceLineFormValue = { description: '', sac: '', quantity: '', unit_price: '' };
  return { ...values, lines: [...values.lines, blank] };
}
