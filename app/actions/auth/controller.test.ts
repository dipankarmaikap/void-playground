import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';

describe('auth controller', () => {
  it('GET /login returns the login page', async () => {
    let response = await router.fetch(new URL(routes.auth.login.index.href(), 'http://localhost'));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });

  it('GET /register returns the register page', async () => {
    let response = await router.fetch(
      new URL(routes.auth.register.index.href(), 'http://localhost'),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
  });
});