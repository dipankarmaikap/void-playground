import * as assert from 'remix/assert';
import { render } from 'remix/component/test';
import { describe, it } from 'remix/test';

import { formFieldAttributes } from './public/form-field.ts';
import { Select } from './select.tsx';

describe('Select', () => {
  it('renders its options under a schema-derived name', async (t) => {
    let { $, cleanup } = render(
      <Select name="payment_term" {...formFieldAttributes({ control: 'select', required: true })}>
        <option value="">Select a payment term</option>
        <option value="net_30">Net 30</option>
      </Select>,
    );
    t.after(cleanup);

    let select = $('select[name="payment_term"]') as HTMLSelectElement;
    assert.equal(select.required, true);
    assert.equal(select.options.length, 2);
    assert.equal(select.options[0].selected, true);
    assert.equal(select.value, '');
  });

  it('keeps its value when an option is picked', async (t) => {
    let { $, act, cleanup } = render(
      <Select name="payment_term">
        <option value="net_30">Net 30</option>
        <option value="due_on_receipt">Due on receipt</option>
      </Select>,
    );
    t.after(cleanup);

    let select = $('select[name="payment_term"]') as HTMLSelectElement;
    select.value = 'due_on_receipt';
    await act(() => select.dispatchEvent(new Event('change', { bubbles: true })));
    assert.equal(select.value, 'due_on_receipt');
  });
});
