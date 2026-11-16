# My Remix App

A Remix 3 app with email/password authentication, DB-backed Sessions, and a shared Client book.

## Features

- Register with Email Verification. Opening a link is read-only; verification happens in a CSRF-protected form submission. The link is printed to the server console; real email delivery is not wired up yet.
- Log in and Log out, with a protected dashboard at `/app/dashboard`.
- Manage a shared Client book at `/app/clients`: create and edit Individual and Business profiles, search and filter, and archive or restore records. The directory shows 20 Clients per page.
- Passwords hashed with `scrypt`; hashes live in `user_passwords`, never on the user row.
- SQLite persistence in `data/app.db`. Tests use an in-memory database instead.
- `/app/settings` manages the User's Profile and display name. `/app/settings/sessions` lists active Sessions (browser, OS, IP, timestamps) and can Revoke one Session or all other Sessions.
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
- Production requires exactly one public-origin mode:
  - `PUBLIC_ORIGIN=https://app.example.com` fixes the request host and HTTPS scheme to a canonical origin and ignores forwarded headers.
  - `TRUST_PROXY=true` trusts forwarded host/protocol headers. Use this only when the app is reachable exclusively through a reverse proxy that overwrites those headers.
- `npm run hmr` opts into its own local trusted proxy automatically. Do not set both `PUBLIC_ORIGIN` and `TRUST_PROXY=true`.
- `SHUTDOWN_GRACE_PERIOD_MS` controls how long shutdown waits for active requests before force-closing remaining connections; it defaults to 10,000 ms.

## Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs.
- `app/router.ts` wires routes to controllers and installs the middleware stack: request context, async context, static and source assets, session, form data, CSRF, auth, CSP, and render.
- `app/actions/controller.tsx` owns the public home route; `app/actions/auth/` owns login, registration, Email Verification, and Log out; `app/actions/app/` owns the protected dashboard, Clients, Profile, and Sessions pages.
- `app/actions/app/clients/` owns the Client directory, profile forms, and lifecycle actions.
- `app/data/` owns SQLite tables, password hashing, display-name parsing, Client data, and hybrid Session storage.
- `app/ui/` holds components shared by more than one route.
- `app/actions/public/` is the browser entry point; root `public/` serves static files unchanged.
- `test/` holds cross-cutting request-flow tests and shared helpers.
- GitHub Issues are the source of truth for feature specs and implementation plans; `docs/` retains ADRs, agent guidance, and manual checks.
