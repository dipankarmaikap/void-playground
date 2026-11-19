import * as assert from 'remix/assert';

import {
  organizationMemberships,
  organizationGstRatePresets,
  organizations,
  users,
  userPasswords,
} from '../app/data/db.ts';
import { testDb as db } from './db-setup.ts';
import { hashPassword } from '../app/data/password.ts';
import { defaultGstPresetRows } from '../app/data/organization/gst-presets.ts';
import { routes } from '../app/routes.ts';

export const origin = 'http://localhost';

export interface TestApp {
  fetch(input: URL | Request | string, init?: RequestInit): Promise<Response>;
}

export function extractCsrf(html: string): string {
  let m = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
  if (!m) m = html.match(/value="([^"]+)"[^>]*name="_csrf"/);
  return m ? m[1] : '';
}

export function cookieFromResponse(res: Response): string {
  let sc = res.headers.get('Set-Cookie');
  if (!sc) return '';
  return sc.split(';')[0];
}

export async function createUser(
  email: string,
  password: string,
  verified = true,
  displayName: string | null = null,
): Promise<string> {
  let id = crypto.randomUUID();
  let organizationId = crypto.randomUUID();
  let now = Date.now();
  await db.transaction(async (tx) => {
    await tx.create(users, {
      id,
      email,
      display_name: displayName,
      email_verified: verified,
      created_at: now,
    });
    await tx.create(userPasswords, {
      user_id: id,
      password_hash: hashPassword(password),
      updated_at: now,
    });
    await tx.create(organizations, {
      id: organizationId,
      name: `Test Organization ${organizationId}`,
      created_at: now,
      updated_at: now,
    });
    await tx.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      user_id: id,
      is_owner: true,
      created_at: now,
    });
    for (let preset of defaultGstPresetRows(organizationId, now)) {
      await tx.create(organizationGstRatePresets, preset);
    }
  });
  return id;
}

/**
 * Loads the form at `url` for a CSRF token and cookie, then submits `fields` back to it.
 * Pass `cookie` when the form is behind authentication.
 */
export async function postForm(
  app: TestApp,
  url: string,
  fields: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  return submitForm(app, url, url, fields, cookie);
}

/**
 * Loads `pageUrl` for a CSRF token, then submits `fields` to `actionUrl`.
 * Use this when a form posts to a URL that has no GET page of its own.
 */
export async function submitForm(
  app: TestApp,
  pageUrl: string,
  actionUrl: string,
  fields: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  let page = await app.fetch(new URL(pageUrl, origin), {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  let csrf = extractCsrf(await page.text());
  let body = new URLSearchParams({ ...fields, _csrf: csrf });
  return app.fetch(new URL(actionUrl, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie ?? cookieFromResponse(page),
    },
    body: body.toString(),
  });
}

export async function login(app: TestApp, email: string, password: string): Promise<string> {
  let response = await postForm(app, routes.auth.login.action.href(), { email, password });
  assert.equal(response.status, 302, 'login should redirect');
  let cookie = cookieFromResponse(response);
  assert.ok(cookie, 'login should set a session cookie');
  return cookie;
}

/**
 * Creates a verified User whose email starts with `emailPrefix`, then signs them in.
 * The unique suffix keeps test files independent when they share the in-memory database.
 */
export async function createUserAndLogin(
  app: TestApp,
  emailPrefix: string,
  displayName: string | null = null,
): Promise<string> {
  let { sessionCookie } = await createUserAndLoginWithOrganization(
    app,
    emailPrefix,
    displayName,
  );
  return sessionCookie;
}

/** Creates a verified User and signs in, returning its server-provisioned Organization ID. */
export async function createUserAndLoginWithOrganization(
  app: TestApp,
  emailPrefix: string,
  displayName: string | null = null,
): Promise<{ sessionCookie: string; organizationId: string }> {
  let email = `${emailPrefix}-${crypto.randomUUID()}@example.com`;
  let userId = await createUser(email, 'password123', true, displayName);
  let membership = await db.findOne(organizationMemberships, { where: { user_id: userId } });
  assert.ok(membership, 'the test User should have an OrganizationMembership');
  return {
    sessionCookie: await login(app, email, 'password123'),
    organizationId: membership.organization_id,
  };
}

/** Fetches `path` as the signed-in User and asserts the page rendered. */
export async function getHtml(app: TestApp, path: string, cookie: string): Promise<string> {
  let response = await app.fetch(new URL(path, origin), {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200, `${path} should render`);
  return response.text();
}
