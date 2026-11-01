# Sessions (DB-backed) Design

Date: 2026-11-02

## Goal

Store sessions in a SQLite table so users can view all active sessions (devices) and log out of individual or all other sessions, via a `/settings` page.

## Data model

New table `sessions`:
- `id` TEXT PK
- `user_id` TEXT FK -> users.id ON DELETE CASCADE
- `data` TEXT NOT NULL (JSON session data)
- `ip` TEXT
- `user_agent` TEXT
- `created_at` INTEGER NOT NULL
- `last_active_at` INTEGER NOT NULL

Session storage switches from cookie-based to DB-backed: cookie holds only session id.

## Routes

- `GET/POST /settings` (protected) — list sessions, revoke one or all others.

## Behavior

- Request context (IP, User-Agent) captured via AsyncLocalStorage middleware and stored on session creation.
- `last_active_at` updated at most every 5 minutes on read.
- Revoke deletes the session row; revoked cookie becomes invalid.
- "Log out all other devices" deletes all rows for the user except current.

## Security

- Revoke verifies ownership (session.user_id === current user).
- Settings protected by requireAuth.

## Testing

- Smoke: GET /settings redirects anonymous.
- Flow: login, view settings, revoke other session.