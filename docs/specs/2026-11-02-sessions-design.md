# Sessions (DB-backed) Design

Date: 2026-11-02

## Goal

Store authenticated sessions in a SQLite table so users can view all active sessions and revoke individual or all other sessions, via an `/app/settings` page.

## Storage strategy

Session storage is hybrid (`app/data/session-storage.ts`):

- Pre-login cookies (holding mostly a CSRF token) stay in the signed cookie, so pre-login page views never write to the database.
- Authenticated sessions store only `db:<session id>` in the cookie and their data in the `sessions` table. Session data is never held in the client for an authenticated session.
- A pre-login cookie that gains `auth` is replaced: logging in rotates the session id, so a new Session row is created and the pre-login cookie is discarded.
- If a `db:` cookie no longer has a row (revoked or expired), the request falls back to an empty pre-login cookie.

## Data model

New table `sessions`:

- `id` TEXT PK
- `user_id` TEXT NOT NULL FK -> users.id ON DELETE CASCADE (indexed)
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
- The settings page lists browser and OS, IP, created, and last-active timestamps; the current session is marked "(this session)".
- Revoke deletes the target session row. The revoked browser's cookie no longer resolves to a row, so its next request is unauthenticated.
- Logging out the current session destroys the session and redirects to `/login`.
- "Revoke all other sessions" deletes all rows for the user except the current one.
- Flash messages report the outcome on the next render.

## Security

- Revoke verifies ownership (`session.user_id === current user id`); the current session can only be ended by its own request, and is then destroyed.
- `/app/settings` is protected by `requireAuth()` on the controller.
- Session ids are random UUIDs inside a signed cookie.
- `SESSION_SECRET` is required in production.
- Unknown or expired session ids degrade to an empty pre-login cookie instead of throwing.

## Testing

- `app/actions/app/controller.test.ts`: anonymous `/app/settings` redirects, authenticated render.
- `test/session-flow.test.ts`: login -> list sessions -> revoke another session; revoke all others; revoke current session logs out. Redirect targets are asserted, not only status codes.
- `test/hybrid-storage.test.ts`: anonymous visits create no rows; login creates exactly one row.
- `app/data/session-storage.test.ts`: expired rows are dropped; active rows are read.
