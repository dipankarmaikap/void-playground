import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { db, sessions } from '../app/data/db.ts';

import { cookieFromResponse, createUser, extractCsrf, login, origin } from './http.ts';

async function seedSession(userId: string, ip: string): Promise<string> {
  let id = crypto.randomUUID();
  await db.create(sessions, {
    id,
    user_id: userId,
    data: JSON.stringify([{ auth: { userId } }, {}]),
    ip,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/1.0',
    created_at: Date.now(),
    last_active_at: Date.now(),
  });
  return id;
}

async function getSettingsPage(sessionCookie: string) {
  let response = await router.fetch(new URL(routes.app.settings.index.href(), origin), {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  return response.text();
}

describe('session flow', () => {
  it('login, view settings, revoke another session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let otherSessionId = await seedSession(userId, '1.2.3.4');

    let sessionCookie = await login(router, email, 'password123');
    let settingsHtml = await getSettingsPage(sessionCookie);
    assert.match(settingsHtml, /Logged-in sessions/);
    assert.match(settingsHtml, /1\.2\.3\.4/);

    let revokeResponse = await router.fetch(
      new URL(routes.app.settings.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({
          _csrf: extractCsrf(settingsHtml),
          action: 'revoke',
          session_id: otherSessionId,
        }).toString(),
      },
    );
    assert.equal(revokeResponse.status, 302);
    assert.equal(revokeResponse.headers.get('Location'), routes.app.settings.index.href());

    let row = await db.find(sessions, otherSessionId);
    assert.equal(row, null);

    let followUp = await router.fetch(
      new URL(revokeResponse.headers.get('Location')!, origin),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(followUp.status, 200);
  });

  it('logs out all other devices', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    await seedSession(userId, '1.1.1.1');
    await seedSession(userId, '2.2.2.2');

    let sessionCookie = await login(router, email, 'password123');
    let settingsHtml = await getSettingsPage(sessionCookie);

    let response = await router.fetch(new URL(routes.app.settings.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({
        _csrf: extractCsrf(settingsHtml),
        action: 'revoke_others',
      }).toString(),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.settings.index.href());

    let remaining = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(remaining.length, 1);

    let followUp = await getSettingsPage(sessionCookie);
    assert.match(followUp, /Logged out all other devices/);
  });

  it('logout destroys the session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let dashboard = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    let csrf = extractCsrf(await dashboard.text());

    let response = await router.fetch(new URL(routes.auth.logout.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({ _csrf: csrf }).toString(),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.home.href());

    let remaining = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(remaining.length, 0);

    let followUp = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: cookieFromResponse(response) },
    });
    assert.equal(followUp.status, 302);
    assert.equal(followUp.headers.get('Location'), routes.auth.login.index.href());
  });

  it('revoking the current session logs out', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let currentRows = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(currentRows.length, 1);

    let dashboard = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    let csrf = extractCsrf(await dashboard.text());

    let response = await router.fetch(new URL(routes.app.settings.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({
        _csrf: csrf,
        action: 'revoke',
        session_id: currentRows[0].id,
      }).toString(),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let row = await db.find(sessions, currentRows[0].id);
    assert.equal(row, null);
  });
});
