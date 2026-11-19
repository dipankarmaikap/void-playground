import * as assert from 'remix/assert';
import { render } from 'remix/component/test';
import { describe, it } from 'remix/test';

import { formFieldAttributes } from './public/form-field.ts';
import { Input } from './input.tsx';

describe('Input', () => {
  it('renders the attributes a shared form schema derives', async (t) => {
    let { $, cleanup } = render(
      <Input
        name="email"
        defaultValue="demo@meridian.test"
        {...formFieldAttributes({ type: 'email', required: true, autoComplete: 'email' })}
      />,
    );
    t.after(cleanup);

    let input = $('input[name="email"]') as HTMLInputElement;
    assert.equal(input.type, 'email');
    assert.equal(input.required, true);
    assert.equal(input.autocomplete, 'email');
    assert.equal(input.defaultValue, 'demo@meridian.test');
  });

  it('marks an invalid field from its parsing issue', async (t) => {
    let { $, cleanup } = render(
      <Input
        name="password"
        {...formFieldAttributes({ type: 'password', minLength: 8 }, 'Password is too short')}
      />,
    );
    t.after(cleanup);

    let input = $('input[name="password"]') as HTMLInputElement;
    assert.equal(input.type, 'password');
    assert.equal(input.minLength, 8);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
  });
});
