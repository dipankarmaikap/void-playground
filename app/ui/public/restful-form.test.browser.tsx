import * as assert from 'remix/assert';
import { render } from 'remix/component/test';
import { describe, it } from 'remix/test';

import { RestfulForm } from './restful-form.tsx';

describe('RestfulForm', () => {
  it('renders a GET form when no method is given', async (t) => {
    let { $, cleanup } = render(<RestfulForm />);
    t.after(cleanup);

    let form = $('form') as HTMLFormElement;
    assert.equal(form.method, 'get');
    assert.equal($('input[type="hidden"]'), null);
  });

  it('renders a plain POST form for POST', async (t) => {
    let { $, cleanup } = render(<RestfulForm method="POST" />);
    t.after(cleanup);

    let form = $('form') as HTMLFormElement;
    assert.equal(form.method, 'post');
    assert.equal($('input[type="hidden"]'), null);
  });

  it('carries PUT as a hidden method override on a POST form', async (t) => {
    let { $, cleanup } = render(<RestfulForm method="PUT" action="/clients/acme/archive" />);
    t.after(cleanup);

    let form = $('form') as HTMLFormElement;
    assert.equal(form.method, 'post');
    let hidden = $('input[type="hidden"]') as HTMLInputElement;
    assert.equal(hidden.name, '_method');
    assert.equal(hidden.value, 'PUT');
    assert.equal(form.action.endsWith('/clients/acme/archive'), true);
  });

  it('carries DELETE as a hidden method override on a POST form', async (t) => {
    let { $, cleanup } = render(<RestfulForm method="DELETE" />);
    t.after(cleanup);

    let form = $('form') as HTMLFormElement;
    assert.equal(form.method, 'post');
    let hidden = $('input[type="hidden"]') as HTMLInputElement;
    assert.equal(hidden.name, '_method');
    assert.equal(hidden.value, 'DELETE');
  });

  it('supports a custom method override field name', async (t) => {
    let { $, cleanup } = render(<RestfulForm method="PUT" methodOverrideField="__method" />);
    t.after(cleanup);

    let hidden = $('input[type="hidden"]') as HTMLInputElement;
    assert.equal(hidden.name, '__method');
    assert.equal(hidden.value, 'PUT');
  });

  it('renders children alongside the hidden method input', async (t) => {
    let { $, cleanup } = render(
      <RestfulForm method="PUT">
        <input type="hidden" name="_csrf" value="token" />
        <button type="submit">Archive client</button>
      </RestfulForm>,
    );
    t.after(cleanup);

    assert.notEqual($('input[name="_csrf"]'), null);
    assert.notEqual($('button[type="submit"]'), null);
    let hidden = $('input[type="hidden"][name="_method"]') as HTMLInputElement;
    assert.equal(hidden.value, 'PUT');
  });
});
