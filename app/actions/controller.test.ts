import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../router.ts';
import { routes } from '../routes.ts';

describe('root controller', () => {
  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
    assert.match(await response.text(), /<html[\s>]/);
  });

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
