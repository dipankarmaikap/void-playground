# Sessions (DB-backed) Design

Date: 2026-11-02

## Goal

Store authenticated sessions in a SQLite table so users can view all active sessions (devices) and log out of individual or all other sessions, via an `/app/settings` page.

## Storage strategy

Session storage is hybrid (`app/data/session-storage.ts`):

- Anonymous sessions (mostly a CSRF token before login) stay in the signed cookie, so anonymous page views never write to the database.
- Authenticated sessions store only `db:<session id>` in the cookie and their data in the `sessions` table. Session data is never held in the client for a logged-in user.
- A legacy cookie session that gains `auth` is promoted to the database on its next save.
- If a `db:` cookie no longer has a row (revoked or expired), the request falls back to an empty anonymous session.

## Data model

New table `sessions`:

- `id` TEXT PK
- `user_id` TEXT FK -> users.id ON DELETE CASCADE (indexed)
- `data` TEXT NOT NULL (JSON session data)
- `ip` TEXT
- `user_agent` TEXT
- `created_at` INTEGER NOT NULL
- `last_active_at` INTEGER NOT NULL

## Lifetime

- Cookie `maxAge` and server-side idle timeout are both 30 days (`SESSION_TTL_SECONDS` / `SESSION_TTL_MS`).
- A session row older than the idle timeout is deleted when read, and expired rows are pruned opportunistically when a new DB session is created.
- `last_active_at` is updated at most every 5 minutes on read.

## Routes

- `GET/POST /app/settings` (protected) — list sessions, revoke one or all others.

## Behavior

- Request context (IP, User-Agent) is captured via `AsyncLocalStorage` middleware and stored on session creation.
- The settings page lists device (browser/OS), IP, created, and last-active timestamps; the current session is marked "(this device)".
- Revoke deletes the target session row. The revoked browser's cookie no longer resolves to a row, so its next request is anonymous.
- Revoking the current session destroys the session and redirects to `/login`.
- "Log out all other devices" deletes all rows for the user except the current one.
- Flash messages report the outcome on the next render.

## Security

- Revoke verifies ownership (`session.user_id === current user id`); the current session can only be revoked by its own request and is then destroyed.
- `/app/settings` is protected by `requireAuth()` on the controller.
- Session ids are random UUIDs inside a signed cookie.
- `SESSION_SECRET` is required in production.
- Unknown or expired session ids degrade to an empty session instead of throwing.

## Testing

- `app/actions/app/controller.test.ts`: anonymous `/app/settings` redirects, authenticated render.
- `test/session-flow.test.ts`: login -> list sessions -> revoke another session; revoke all others; revoke current session logs out. Redirect targets are asserted, not only status codes.
- `test/hybrid-storage.test.ts`: anonymous visits create no rows; login creates exactly one row.
- `app/data/session-storage.test.ts`: expired rows are dropped; active rows are read.
