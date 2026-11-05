# Auth (Email/Password) Design

Date: 2026-11-01

## Goal

Add email/password authentication to the Remix app: registration with email verification, login, logout, and a protected dashboard. Verification links are logged to the console (email service to be added later). Persistence uses a local SQLite file. Password hashes are stored in a separate table so user records never carry them.

## Scope

In scope:

- Register, verify email, login, logout
- Protected `/app/dashboard`
- SQLite-backed users and credentials
- Session-backed auth via Remix middleware
- CSRF protection on form posts

Out of scope (YAGNI):

- Password reset, rate limiting, account deletion, OAuth
- Real email delivery (console log only)
- Role/authorization beyond authenticated/unauthenticated

## Data model

SQLite file: `data/app.db` (resolved from `import.meta.dirname`). Tests use `:memory:` instead.

Tables:

`users`

- `id` TEXT PRIMARY KEY
- `email` TEXT NOT NULL UNIQUE (stored trimmed and lowercased)
- `email_verified` INTEGER NOT NULL DEFAULT 0
- `verification_token` TEXT (indexed)
- `verification_expires_at` INTEGER
- `created_at` INTEGER NOT NULL

`user_passwords`

- `user_id` TEXT PRIMARY KEY, FK -> users.id ON DELETE CASCADE
- `password_hash` TEXT NOT NULL
- `updated_at` INTEGER NOT NULL

A user row never contains a password hash. Queries that load a "current user" select only from `users`.

## Routes

- `GET/POST /login` (form)
- `GET/POST /register` (form)
- `GET /verify?token=...`
- `POST /logout`
- `GET /app/dashboard` (protected)
- existing `GET /`, `GET /assets/*path`

Session management routes (`/app/settings`) are described in the sessions design.

## Middleware (global, in order)

1. `requestContextMiddleware` (captures IP and User-Agent in AsyncLocalStorage)
2. `staticFiles('./public')`
3. `session(sessionCookie, hybridSessionStorage)`
4. `formData()`
5. `csrf()`
6. `auth({ schemes: [sessionScheme] })`
7. `render({ assets })`

Route protection is controller middleware (`requireAuth`), not a global path check.

## Flows

### Register

1. Parse/validate `email`, `password` (min 8 chars) via `remix/data-schema`.
2. Normalize email (`trim().toLowerCase()`).
3. If email exists, flash "Email already registered" and redirect `/register`. The unique constraint is also caught so a concurrent duplicate cannot produce a 500.
4. Hash password with Node crypto (scrypt).
5. Insert user (unverified) + verification token (random UUID, 24h expiry) and `user_passwords` in a transaction.
6. Console.log verification link generated from `routes.auth.verify.href()`.
7. Flash "Check your email to verify your account" and redirect `/login`.

### Verify

1. Look up user by `verification_token` where not expired.
2. If none/invalid/expired, flash error and redirect `/login`.
3. Set `email_verified=1`, clear token/expiry.
4. Flash success and redirect `/login`.

### Login

1. Parse credentials, normalizing email the same way as registration.
2. `verifyCredentials(credentialsProvider, context)`:
   - find user by email; return null if missing, unverified, or password mismatch.
3. On null: flash "Invalid email or password" and redirect `/login`.
4. On success: `completeAuth(context)` (rotates session id), `session.set('auth', { userId })`, redirect `/app/dashboard`.

### Logout

`session.destroy()`, redirect `/`. Destroying removes the server-side session row and clears the cookie.

### Dashboard

Protected by `requireAuth<User>()` on the controller. Loads user from `users` (no hash). Renders email + logout form. Anonymous -> redirect `/login`.

## Components

Server-rendered pages using `Document` and `css`:

- `app/actions/auth/login/page.tsx` — email, password, csrf, error and success messages
- `app/actions/auth/register/page.tsx` — email, password, csrf, error
- `app/actions/app/dashboard-page.tsx` — email, logout form with csrf, settings link

Links and form actions are generated from `routes.*.href()`.

## Security

- Passwords hashed with scrypt via Node crypto.
- Session cookie signed, httpOnly, sameSite lax, secure auto; 30-day lifetime.
- `SESSION_SECRET` is required in production; development uses a fixed fallback.
- CSRF synchronizer token in all mutating forms.
- `completeAuth` rotates the session id on login.
- Password hash isolated in `user_passwords`; user-loading code never joins it.
- Login failures are generic, so they do not reveal which emails exist.

## Testing

- `app/actions/auth/controller.test.ts`: route smoke tests, authenticated redirects, unverified login rejection, missing CSRF rejection, expired token, duplicate email.
- `test/auth-flow.test.ts`: register (mixed-case email) -> verify -> login -> dashboard; invalid registration renders 400.
- `app/actions/app/controller.test.ts`: anonymous redirects and authenticated renders.
- `test/http.ts`: shared `createUser`, `login`, CSRF and cookie helpers.

## Files

- `app/data/db.ts` — SQLite tables and indexes
- `app/data/password.ts` — scrypt hash/verify
- `app/routes.ts`, `app/router.ts`
- `app/actions/controller.tsx` (home)
- `app/actions/auth/controller.tsx` (verify, logout)
- `app/actions/auth/login/{controller,page}.tsx`
- `app/actions/auth/register/{controller,page}.tsx`
- `app/actions/app/controller.tsx`, `app/actions/app/dashboard-page.tsx`
