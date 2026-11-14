import * as assert from 'remix/assert';

import { db, users, userPasswords } from '../app/data/db.ts';
import { hashPassword } from '../app/data/password.ts';
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
  await db.create(users, {
    id,
    email,
    display_name: displayName,
    email_verified: verified,
    created_at: Date.now(),
  });
  await db.create(userPasswords, {
    user_id: id,
    password_hash: hashPassword(password),
    updated_at: Date.now(),
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
