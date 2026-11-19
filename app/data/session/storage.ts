import { AsyncLocalStorage } from 'node:async_hooks';

import { lt } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { createSession } from 'remix/session';
import type { Session, SessionStorage } from 'remix/session';
import { createCookieSessionStorage } from 'remix/session-storage/cookie';

import { sessions } from '../db.ts';
import { AUTH_SESSION_KEY } from './auth-payload.ts';
import type { AuthPayload } from './auth-payload.ts';

export interface SessionRequestContext {
  ip: string;
  userAgent: string;
}

export const sessionRequestContext = new AsyncLocalStorage<SessionRequestContext>();

const FIVE_MINUTES = 5 * 60 * 1000;
const DB_PREFIX = 'db:';

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

// Authenticated sessions live in the DB; pre-login cookies (mostly CSRF tokens) stay in the cookie.
export function createHybridSessionStorage(
  db: SqliteDatabase,
  preLoginStorage: SessionStorage = createCookieSessionStorage(),
): SessionStorage {
  let cookieStorage = preLoginStorage;
  return {
    async read(cookie) {
      if (cookie && cookie.startsWith(DB_PREFIX)) {
        let id = cookie.slice(DB_PREFIX.length);
        try {
          let row = await db.find(sessions, id);
          if (row && Date.now() - row.last_active_at > SESSION_TTL_MS) {
            await db.delete(sessions, id);
          } else if (row) {
            let now = Date.now();
            if (now - row.last_active_at >= FIVE_MINUTES) {
              db.update(sessions, id, { last_active_at: now }).catch(() => {});
            }
            let data = JSON.parse(row.data);
            return createSession(id, data);
          }
        } catch {
          // fall through
        }
      }
      let cookieValue = cookie && !cookie.startsWith(DB_PREFIX) ? cookie : null;
      return cookieStorage.read(cookieValue);
    },
    async save(session: Session) {
      // always attempt to clean up a previous DB row (harmless if none)
      if (session.deleteId) {
        await db.delete(sessions, session.deleteId);
      }

      if (session.destroyed) {
        await db.delete(sessions, session.id);
        return '';
      }

      if (!session.dirty) {
        return null;
      }

      // Tolerant read: a Session's serialized data may predate the canonical
      // payload shape, so treat every payload field as optional here.
      let auth = session.get(AUTH_SESSION_KEY) as Partial<AuthPayload> | undefined;
      let userId = auth?.userId;

      if (userId) {
        let now = Date.now();
        let data = JSON.stringify(session.data);
        let existing = await db.find(sessions, session.id);
        if (existing) {
          await db.update(sessions, session.id, {
            data,
            user_id: userId,
            last_active_at: now,
          });
        } else {
          let ctx = sessionRequestContext.getStore();
          await db.create(sessions, {
            id: session.id,
            user_id: userId,
            data,
            ip: ctx?.ip ?? null,
            user_agent: ctx?.userAgent ?? null,
            created_at: now,
            last_active_at: now,
          });
          db.deleteMany(sessions, { where: lt('last_active_at', now - SESSION_TTL_MS) }).catch(
            () => {},
          );
        }
        return DB_PREFIX + session.id;
      }

      return cookieStorage.save(session);
    },
  };
}
