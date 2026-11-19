import * as assert from 'remix/assert';
import { render } from 'remix/component/test';
import { describe, it } from 'remix/test';

import { Field } from './field.tsx';

describe('Field', () => {
  it('associates its label with the control it wraps', async (t) => {
    let { $, cleanup } = render(
      <Field label="Email">
        <input name="email" type="email" />
      </Field>,
    );
    t.after(cleanup);

    let label = $('label') as HTMLLabelElement;
    let input = $('input[name="email"]') as HTMLInputElement;
    assert.equal(label.control, input);
    assert.equal(label.textContent?.startsWith('Email'), true);
  });

  it('renders its hint below the control', async (t) => {
    let { $, cleanup } = render(
      <Field label="Display name" hint="Shown instead of your email address.">
        <input name="display_name" />
      </Field>,
    );
    t.after(cleanup);

    let hint = $('span');
    assert.ok(hint);
    assert.equal(hint.textContent, 'Shown instead of your email address.');
  });

  it('renders the error text under the id it is given', async (t) => {
    let { $, cleanup } = render(
      <Field label="Email" error="Enter a valid email address" errorId="email-error">
        <input name="email" />
      </Field>,
    );
    t.after(cleanup);

    let error = $('#email-error');
    assert.ok(error);
    assert.equal(error.textContent, 'Enter a valid email address');
    assert.equal(error instanceof HTMLSpanElement, true);
  });
});
