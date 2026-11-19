import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createAppRouter } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { sessions } from '../app/data/db.ts';
import { testDb as db } from './db-setup.ts';

import { cookieFromResponse, createUser, extractCsrf, login, origin } from './http.ts';

const router = createAppRouter({ db });

async function seedSession(userId: string, ip: string, createdAt = Date.now()): Promise<string> {
  let id = crypto.randomUUID();
  await db.create(sessions, {
    id,
    user_id: userId,
    data: JSON.stringify([{ auth: { userId } }, {}]),
    ip,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/1.0',
    created_at: createdAt,
    last_active_at: createdAt,
  });
  return id;
}

async function getSessionsPage(sessionCookie: string) {
  let response = await router.fetch(new URL(routes.app.settings.sessions.index.href(), origin), {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  return response.text();
}

describe('session flow', () => {
  it('login, view sessions, revoke another session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let otherSessionId = await seedSession(userId, '1.2.3.4');

    let sessionCookie = await login(router, email, 'password123');
    let sessionsHtml = await getSessionsPage(sessionCookie);
    assert.match(sessionsHtml, /Sessions/);
    assert.match(sessionsHtml, /1\.2\.3\.4/);
    assert.match(sessionsHtml, /Chrome/);
    assert.match(sessionsHtml, /Created/);
    assert.match(sessionsHtml, /Last active/);
    assert.match(sessionsHtml, /This session/);

    let revokeResponse = await router.fetch(
      new URL(routes.app.settings.sessions.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({
          _csrf: extractCsrf(sessionsHtml),
          action: 'revoke',
          session_id: otherSessionId,
        }).toString(),
      },
    );
    assert.equal(revokeResponse.status, 302);
    assert.equal(
      revokeResponse.headers.get('Location'),
      routes.app.settings.sessions.index.href(),
    );

    let row = await db.find(sessions, otherSessionId);
    assert.equal(row, null);

    let followUp = await router.fetch(
      new URL(revokeResponse.headers.get('Location')!, origin),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(followUp.status, 200);
  });

  it('shows the current session first with a text marker', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');
    // Newer than the current session, so plain date order would put it first.
    await seedSession(userId, '9.9.9.9', Date.now() + 60_000);

    let sessionsHtml = await getSessionsPage(sessionCookie);
    assert.ok(sessionsHtml.indexOf('This session') < sessionsHtml.indexOf('9.9.9.9'));
  });

  it('offers no row-level Revoke for the current session', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let sessionsHtml = await getSessionsPage(sessionCookie);
    assert.match(sessionsHtml, /This session/);
    assert.doesNotMatch(sessionsHtml, /name="action" value="revoke"/);
    assert.doesNotMatch(sessionsHtml, /value="revoke_others"/);
  });

  it('guards revoking all other sessions with a no-JS confirmation', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    await seedSession(userId, '1.1.1.1');

    let sessionCookie = await login(router, email, 'password123');
    let sessionsHtml = await getSessionsPage(sessionCookie);

    assert.match(
      sessionsHtml,
      /<details[^>]*>[\s\S]*?Revoke all other sessions[\s\S]*?value="revoke_others"[\s\S]*?<\/details>/,
    );
    assert.match(sessionsHtml, /except this one/);
  });

  it('revokes all other sessions', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    await seedSession(userId, '1.1.1.1');
    await seedSession(userId, '2.2.2.2');

    let sessionCookie = await login(router, email, 'password123');
    let sessionsHtml = await getSessionsPage(sessionCookie);

    let response = await router.fetch(new URL(routes.app.settings.sessions.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({
        _csrf: extractCsrf(sessionsHtml),
        action: 'revoke_others',
      }).toString(),
    });
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      routes.app.settings.sessions.index.href(),
    );

    let remaining = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(remaining.length, 1);

    let followUp = await getSessionsPage(sessionCookie);
    assert.match(followUp, /Revoked all other sessions/);
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

  it('does not report successful Log out when Session deletion fails', async () => {
    let email = `u-${crypto.randomUUID()}@example.com`;
    let userId = await createUser(email, 'password123');
    let sessionCookie = await login(router, email, 'password123');
    let currentRows = await db.findMany(sessions, { where: { user_id: userId } });
    assert.equal(currentRows.length, 1);

    let dashboard = await router.fetch(new URL(routes.app.dashboard.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    let csrf = extractCsrf(await dashboard.text());

    await db.executeScript(`
      CREATE TRIGGER fail_session_delete
      BEFORE DELETE ON sessions
      BEGIN
        SELECT RAISE(ABORT, 'session delete failed');
      END;
    `);

    try {
      let response: Response | undefined;
      let failure: unknown;
      try {
        response = await router.fetch(new URL(routes.auth.logout.href(), origin), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: sessionCookie,
          },
          body: new URLSearchParams({ _csrf: csrf }).toString(),
        });
      } catch (error) {
        failure = error;
      }

      assert.ok(
        failure || (response && response.status >= 500),
        'a failed server-side deletion must not return a successful Log out response',
      );
      assert.ok(await db.find(sessions, currentRows[0].id), 'the failed deletion leaves the row');
    } finally {
      await db.executeScript('DROP TRIGGER IF EXISTS fail_session_delete;');
    }
  });

  it('does not list or Revoke a Session owned by another User', async () => {
    let firstEmail = `u-${crypto.randomUUID()}@example.com`;
    let secondEmail = `u-${crypto.randomUUID()}@example.com`;
    let firstUserId = await createUser(firstEmail, 'password123');
    let secondUserId = await createUser(secondEmail, 'password123');
    let foreignSessionId = await seedSession(secondUserId, '8.8.8.8');
    let sessionCookie = await login(router, firstEmail, 'password123');
    let sessionsHtml = await getSessionsPage(sessionCookie);

    assert.doesNotMatch(sessionsHtml, /8\.8\.8\.8/);

    let response = await router.fetch(
      new URL(routes.app.settings.sessions.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({
          _csrf: extractCsrf(sessionsHtml),
          action: 'revoke',
          session_id: foreignSessionId,
        }).toString(),
      },
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      routes.app.settings.sessions.index.href(),
    );
    assert.equal(await db.find(sessions, foreignSessionId) == null, false);
    assert.ok(firstUserId !== secondUserId);
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

    let response = await router.fetch(
      new URL(routes.app.settings.sessions.action.href(), origin),
      {
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
      },
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());

    let row = await db.find(sessions, currentRows[0].id);
    assert.equal(row, null);
  });
});
