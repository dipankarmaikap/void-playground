import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../../router.ts';
import { routes } from '../../routes.ts';
import { createUser, login, origin } from '../../../test/http.ts';

describe('app controller', () => {
  it('GET /app/dashboard redirects anonymous visitors to /login', async () => {
    let response = await router.fetch(new URL(routes.app.dashboard.href(), origin));

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
  });

  it('GET /app/settings redirects anonymous visitors to /login', async () => {
    let response = await router.fetch(new URL(routes.app.settings.index.href(), origin));

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
  });

  it('GET /app/dashboard renders for an authenticated user', async () => {
    let email = `app-${crypto.randomUUID()}@example.com`;
    await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let response = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 200);
  });

  it('GET /app/settings renders for an authenticated user', async () => {
    let email = `app-${crypto.randomUUID()}@example.com`;
    await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let response = await router.fetch(new URL(routes.app.settings.index.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 200);
  });
});
