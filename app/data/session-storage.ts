import { AsyncLocalStorage } from 'node:async_hooks';

import { createSession } from 'remix/session';
import type { Session, SessionStorage } from 'remix/session';
import { createCookieSessionStorage } from 'remix/session-storage/cookie';


import { db, sessions } from './db.ts';

export interface SessionRequestContext {
  ip: string;
  userAgent: string;
}

export const sessionRequestContext = new AsyncLocalStorage<SessionRequestContext>();

const FIVE_MINUTES = 5 * 60 * 1000;
const DB_PREFIX = 'db:';
const cookieStorage = createCookieSessionStorage();

export function createHybridSessionStorage(): SessionStorage {
  return {
    async read(cookie) {
      if (cookie && cookie.startsWith(DB_PREFIX)) {
        let id = cookie.slice(DB_PREFIX.length);
        try {
          let row = await db.find(sessions, id);
          if (row) {
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
        db.delete(sessions, session.deleteId).catch(() => {});
      }

      if (session.destroyed) {
        db.delete(sessions, session.id).catch(() => {});
        return '';
      }

      if (!session.dirty) {
        return null;
      }

      let auth = session.get('auth') as { userId?: string } | undefined;
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
        }
        return DB_PREFIX + session.id;
      }

      return cookieStorage.save(session);
    },
  };
}

