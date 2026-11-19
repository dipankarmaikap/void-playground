import * as assert from 'remix/assert';
import { render } from 'remix/component/test';
import { describe, it } from 'remix/test';

import { Button } from './button.tsx';

describe('Button', () => {
  it('submits its form when no type is given', async (t) => {
    let { $, cleanup } = render(
      <form>
        <Button>Save client</Button>
      </form>,
    );
    t.after(cleanup);

    let button = $('button') as HTMLButtonElement;
    assert.equal(button.type, 'submit');

    let submissions = 0;
    button.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      submissions++;
    });

    button.click();
    assert.equal(submissions, 1);
  });

  it('does not submit its form when its type is button', async (t) => {
    let { $, cleanup } = render(
      <form>
        <Button type="button">Cancel</Button>
      </form>,
    );
    t.after(cleanup);

    let button = $('button') as HTMLButtonElement;
    assert.equal(button.type, 'button');

    let submissions = 0;
    button.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      submissions++;
    });

    button.click();
    assert.equal(submissions, 0);
  });

  it('marks its variant for styling', async (t) => {
    let { $$, cleanup } = render(
      <>
        <Button>Save</Button>
        <Button variant="secondary">Archive</Button>
        <Button variant="danger">Delete</Button>
      </>,
    );
    t.after(cleanup);

    let variants = Array.from($$('button')).map(
      (button) => (button as HTMLElement).dataset.variant,
    );
    assert.deepEqual(variants, ['primary', 'secondary', 'danger']);
  });
});
