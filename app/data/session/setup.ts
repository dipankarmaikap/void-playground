import { createCookie } from 'remix/cookie';
import { createSessionAuthScheme } from 'remix/middleware/auth';

import { db, users } from '../db.ts';
import type { User } from '../db.ts';
import { AUTH_SESSION_KEY, readAuthPayload } from './auth-payload.ts';
import type { AuthPayload } from './auth-payload.ts';
import {
  createHybridSessionStorage,
  SESSION_TTL_SECONDS,
} from './storage.ts';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}

export const sessionCookie = createCookie('__session', {
  secrets: [sessionSecret || 'dev-secret-change-me'],
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});

export const sessionStorage = createHybridSessionStorage();

export const sessionScheme = createSessionAuthScheme<User, AuthPayload>({
  read: readAuthPayload,
  async verify(value) {
    return (await db.find(users, value.userId)) ?? null;
  },
  invalidate(session) {
    session.unset(AUTH_SESSION_KEY);
  },
});