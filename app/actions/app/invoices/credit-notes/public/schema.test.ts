import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { CREDIT_NOTE_REASON_MAX_LENGTH } from '../../../../../data/invoices/credit-notes.ts';
import { formFieldAttributes } from '../../../../../ui/public/form-field.ts';
import { CreditNoteForm, creditNoteFormFields, parseCreditNoteFormValues } from './schema.ts';

describe('credit note form schema', () => {
  it('parses the date, reason, and repeated line submissions', () => {
    let formData = new FormData();
    formData.set('credit_date', '2026-11-19');
    formData.set('reason', 'Volume discount');
    formData.append('line_id', 'line-1');
    formData.append('line_id', 'line-2');
    formData.append('line_quantity', '1');

    let values = parseCreditNoteFormValues(formData);
    assert.equal(values.credit_date, '2026-11-19');
    assert.equal(values.reason, 'Volume discount');
    assert.deepEqual(values.lines, [
      { invoice_line_id: 'line-1', quantity: '1' },
      { invoice_line_id: 'line-2', quantity: '' },
    ]);
  });

  it('reads no lines when none are submitted', () => {
    let values = parseCreditNoteFormValues(new FormData());
    assert.deepEqual(values.lines, []);
  });

  it('describes exactly the fields the schema parses', () => {
    let parsed = s.parseSafe(CreditNoteForm, new FormData());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(Object.keys(parsed.value).sort(), Object.keys(creditNoteFormFields).sort());
    }
  });

  it('derives the browser attributes the credit note form renders', () => {
    assert.deepEqual(formFieldAttributes(creditNoteFormFields.credit_date), {
      type: 'date',
      required: true,
    });
    let reason = formFieldAttributes(creditNoteFormFields.reason);
    assert.equal(reason.required, true);
    assert.equal(reason.maxLength, CREDIT_NOTE_REASON_MAX_LENGTH);
    assert.deepEqual(formFieldAttributes(creditNoteFormFields.line_quantity), { type: 'number' });
  });
});
