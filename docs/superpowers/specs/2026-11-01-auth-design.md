# Auth (Email/Password) Design

Date: 2026-11-01

## Goal

Add email/password authentication to the Remix app: registration with email verification, login, logout, and a protected dashboard. Verification links are logged to the console (email service to be added later). Persistence uses a local SQLite file. Password hashes are stored in a separate table so user records never carry them.

## Scope

In scope:
- Register, verify email, login, logout
- Protected `/dashboard`
- SQLite-backed users and credentials
- Session-backed auth via Remix middleware
- CSRF protection on form posts

Out of scope (YAGNI):
- Password reset, rate limiting, account deletion, OAuth
- Real email delivery (console log only)
- Role/authorization beyond authenticated/unauthenticated

## Data model

SQLite file: `data/app.db` (resolved from `import.meta.dirname`).

Tables:

`users`
- `id` TEXT PRIMARY KEY
- `email` TEXT NOT NULL UNIQUE
- `email_verified` INTEGER NOT NULL DEFAULT 0
- `verification_token` TEXT
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
- `GET /dashboard` (protected)
- existing `GET /`, `GET /assets/*path`

## Middleware (global, in order)

1. `staticFiles('./public')`
2. `session(sessionCookie, cookieSessionStorage)`
3. `formData()`
4. `csrf()`
5. `auth({ schemes: [sessionScheme] })`
6. `render({ assets })`

## Flows

### Register
1. Parse/validate `email`, `password` (min 8 chars) via `remix/data-schema`.
2. If email exists, flash error and redirect `/register`.
3. Hash password with `Bun.password.hash`.
4. Insert user (unverified) + verification token (random UUID, 24h expiry) in a transaction; insert `user_passwords`.
5. Console.log verification link `${origin}/verify?token=${token}`.
6. Flash "Check your email to verify your account" and redirect `/login`.

### Verify
1. Look up user by `verification_token` where not expired.
2. If none/invalid/expired, flash error and redirect `/login`.
3. Set `email_verified=1`, clear token/expiry.
4. Flash success and redirect `/login`.

### Login
1. `verifyCredentials(credentialsProvider, context)`:
   - find user by email; return null if missing, unverified, or password mismatch.
2. On null: flash "Invalid email or password" and redirect `/login`.
3. On success: `completeAuth(context)`, `session.set('auth', { userId })`, redirect `/dashboard`.

### Logout
`session.unset('auth')`, `session.regenerateId(true)`, redirect `/`.

### Dashboard
Protected by `requireAuth<User>()`. Loads user from `users` (no hash). Renders email + logout form. Anonymous -> redirect `/login`.

## Components

Simple server-rendered pages using `Document` and `css`:
- `LoginPage` (email, password, csrf, flash error)
- `RegisterPage` (email, password, csrf, flash error)
- `DashboardPage` (email, logout form with csrf)

## Security

- Passwords hashed with Argon2id via `Bun.password`.
- Session cookie signed, httpOnly, sameSite lax, secure auto.
- CSRF synchronizer token in all mutating forms.
- `completeAuth` rotates session id on login.
- Password hash isolated in `user_passwords`; user-loading code never joins it.

## Testing

- Router smoke tests for new routes (existing `controller.test.ts` pattern).
- Unit-ish check: register then verify then login reaches dashboard; unverified login rejected.

## Files touched

- `app/data/db.ts` (new)
- `app/routes.ts`
- `app/router.ts`
- `app/actions/controller.tsx`
- `app/actions/auth/controller.tsx` (new)
- `app/actions/auth/pages.tsx` (new)
- `app/actions/controller.test.ts` (extend)
