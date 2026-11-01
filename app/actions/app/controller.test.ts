import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';

describe('app controller', () => {
  it('GET /app/dashboard redirects anonymous visitors to /login', async () => {
    let response = await router.fetch(new URL(routes.app.dashboard.href(), 'http://localhost'));

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/login');
  });

  it('GET /app/settings redirects anonymous visitors to /login', async () => {
    let response = await router.fetch(new URL(routes.app.settings.index.href(), 'http://localhost'));

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/login');
  });
});