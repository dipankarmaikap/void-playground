import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import * as s from 'remix/data-schema';

import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import {
  InvoiceDraftForm,
  InternalNoteForm,
  INTERNAL_NOTE_MAX_LENGTH,
  invoiceDraftFormFields,
  parseInvoiceFormValues,
} from './schema.ts';

describe('invoice draft form schema', () => {
  it('parses scalars and repeated service-line fields into form values', () => {
    let formData = new FormData();
    formData.set('client_id', 'client-1');
    formData.set('currency', 'INR');
    formData.set('invoice_date', '2026-11-19');
    formData.append('line_description', 'Consulting');
    formData.append('line_description', 'Support');
    formData.append('line_quantity', '2');

    let { values, issues } = parseInvoiceFormValues(formData);
    assert.deepEqual(issues, []);
    assert.equal(values.client_id, 'client-1');
    assert.equal(values.currency, 'INR');
    assert.equal(values.lines.length, 2);
    assert.equal(values.lines[0].description, 'Consulting');
    assert.equal(values.lines[0].quantity, '2');
    assert.equal(values.lines[1].description, 'Support');
    assert.equal(values.lines[1].quantity, '');
  });

  it('keeps one blank line when no line fields are submitted', () => {
    let formData = new FormData();
    formData.set('currency', 'USD');

    let { values, issues } = parseInvoiceFormValues(formData);
    assert.deepEqual(issues, []);
    assert.equal(values.lines.length, 1);
    assert.equal(values.lines[0].description, '');
    assert.equal(values.lines[0].unit_price, '');
  });

  it('defaults missing scalar fields to empty strings', () => {
    let { values } = parseInvoiceFormValues(new FormData());
    assert.equal(values.currency, '');
    assert.equal(values.invoice_date, '');
    assert.equal(values.recipient_legal_name, '');
    assert.equal(values.round_off, '');
  });

  it('describes exactly the fields the schema parses', () => {
    let formData = new FormData();
    formData.set('currency', 'INR');
    formData.append('line_description', 'One');

    let parsed = s.parseSafe(InvoiceDraftForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(
        Object.keys(parsed.value).sort(),
        Object.keys(invoiceDraftFormFields).sort(),
      );
    }
  });

  it('derives the browser attributes the invoice form renders', () => {
    assert.deepEqual(formFieldAttributes(invoiceDraftFormFields.invoice_date), { type: 'date' });
    assert.equal(formFieldAttributes(invoiceDraftFormFields.currency).maxLength, 3);
    assert.equal(
      formFieldAttributes(invoiceDraftFormFields.export_reference).maxLength,
      200,
    );
    assert.equal(
      formFieldAttributes(invoiceDraftFormFields.line_foreign_tax_label).maxLength,
      80,
    );
    assert.equal('type' in formFieldAttributes(invoiceDraftFormFields.payment_term), false);
  });

  it('parses the internal note form with its length bound', () => {
    let formData = new FormData();
    formData.set('internal_note', 'Follow up after client call');

    let parsed = s.parseSafe(InternalNoteForm, formData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.value.internal_note, 'Follow up after client call');
    }
    assert.equal(INTERNAL_NOTE_MAX_LENGTH, 1000);
  });
});
