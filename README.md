# My Remix App

A Remix 3 app with email/password authentication and DB-backed session management.

## Features

- Register with email verification. The verification link is printed to the server console; real email delivery is not wired up yet.
- Log in and log out, with a protected dashboard at `/app/dashboard`.
- Passwords hashed with `scrypt`; hashes live in `user_passwords`, never on the user row.
- SQLite persistence in `data/app.db`. Tests use an in-memory database instead.
- `/app/settings` lists active sessions (browser, OS, IP, timestamps) and can revoke one device or all other devices.
- CSRF synchronizer tokens on every mutating form.
- Nonce-based Content Security Policy on HTML responses, with a dev-only allowance for HMR connections.
- `npm run hmr` for live server and browser updates through a stable proxy.

## Commands

```sh
npm install
npm run dev
npm run hmr
npm run start
npm test
npm run typecheck
npm run lint
```

`npm run dev` watches and restarts the server; refresh the browser to see changes. `npm run hmr` adds live server and browser updates through a stable proxy. `npm run start` runs in production mode without a separate build step.

## Configuration

- `SESSION_SECRET` signs the `__session` cookie. It is required when `NODE_ENV=production`; development falls back to a fixed local secret.
- The session cookie lives for 30 days. Authenticated sessions live in the `sessions` table and expire after 30 days of inactivity.

## Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs.
- `app/router.ts` wires routes to controllers and installs the middleware stack: request context, async context, static files, session, form data, CSRF, auth, CSP, render.
- `app/actions/controller.tsx` owns the root routes; `app/actions/auth/` owns login, register, verify, and logout; `app/actions/app/` owns the protected dashboard and settings pages.
- `app/data/` owns SQLite tables, password hashing, and the hybrid session storage.
- `app/ui/` holds components shared by more than one route.
- `app/actions/public/` is the browser entry point; root `public/` serves static files unchanged.
- `test/` holds cross-cutting request-flow tests and shared helpers.
- `docs/specs/` and `docs/plans/` hold the design and implementation plan for each feature.
