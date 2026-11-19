import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

import { CREDIT_NOTE_REASON_MAX_LENGTH } from '../../../../../data/invoices/credit-notes.ts';
import type { CreditNoteFormValues, CreditNoteLineInput } from '../../../../../data/invoices/credit-note-form-values.ts';
import type { FormFieldDescriptor } from '../../../../../ui/public/form-field.ts';

/**
 * The Credit Note Draft form, described once. Date and reason rules and the per-line quantity
 * bounds are the domain parser's; the schema types the submitted shape and the descriptor table
 * supplies the input attributes the draft page renders.
 */
export const CreditNoteForm = f.object({
  credit_date: f.field(s.defaulted(s.string(), '')),
  reason: f.field(s.defaulted(s.string(), '')),
  line_id: f.fields(s.array(s.string())),
  line_quantity: f.fields(s.array(s.string())),
});

export const creditNoteFormFields = {
  credit_date: { type: 'date', required: true },
  reason: { control: 'textarea', required: true, maxLength: CREDIT_NOTE_REASON_MAX_LENGTH },
  line_id: { control: 'hidden' },
  line_quantity: { type: 'number' },
} satisfies Record<string, FormFieldDescriptor>;

/**
 * Parses the Credit Note form through the shared schema, zipping the repeated source-line ids and
 * quantities without trusting their values. A submission the schema cannot read as text fails
 * closed to blank values so the domain parser reports it with the page's own issue contract.
 */
export function parseCreditNoteFormValues(formData: FormData): CreditNoteFormValues {
  let parsed = s.parseSafe(CreditNoteForm, formData);
  if (!parsed.success) {
    return { credit_date: '', reason: '', lines: [] };
  }

  let count = Math.max(parsed.value.line_id.length, parsed.value.line_quantity.length);
  let lines: CreditNoteLineInput[] = [];
  for (let index = 0; index < count; index += 1) {
    lines.push({
      invoice_line_id: parsed.value.line_id[index] ?? '',
      quantity: parsed.value.line_quantity[index] ?? '',
    });
  }

  return {
    credit_date: parsed.value.credit_date,
    reason: parsed.value.reason,
    lines,
  };
}
