# My Remix App Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

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

`typecheck` runs `tsc --noEmit`; `npm run lint` runs oxlint.

`npm run dev` watches and restarts the server (refresh the browser to see changes); `npm run hmr` adds live server and browser updates through a stable proxy; `npm run start` runs in production mode without a separate build step.

Node.js is the runtime; npm is the package manager. Scripts run `server.ts` via `remix/node-tsx`.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md for the Remix mental model and how to find guides and API READMEs through `node_modules/remix/INDEX.md`.

## Docs

GitHub Issues are the canonical home for feature specs, acceptance criteria, and implementation plans. Use `docs/agents/issue-tracker.md` for the `gh` workflow. Keep durable architectural decisions in `docs/adr/`, project agent guidance in `docs/agents/`, and repeatable manual checks (browser-only and CLI) in `docs/manual-checks/`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `dipankarmaikap/void-playground`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, each label string matching its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`, e.g. `feat(auth): add session cookie`. Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Summary in lowercase, imperative, no trailing period; add a body only when the why is not obvious.

## App Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs. Use `routes.*.href()` in links, forms, and redirects instead of string literals.
- `app/router.ts` wires routes to controllers and installs the middleware stack: request context, async context, static files, session, form data, method override, CSRF, auth, CSP, render. No-JS forms submit PUT and DELETE through the shared `app/ui/public/restful-form.tsx` wrapper's hidden `_method` field.
- `app/config.ts` owns `APP_NAME` (the single product name used for branding and metadata) and `DISPLAY_NAME_MAX_LENGTH`.
- `hmr.ts` supervises the development server for `npm run hmr`, proxying requests while server and browser modules reload.
- Authored `<script>` and `<style>` tags need the request nonce from `getCspNonce(getContext())`; import maps, module preloads, and `css()` styles get it from `render()` automatically.
- Put top-level route actions in `app/actions/controller.tsx`; give every nested route map its own directory with `controller.tsx` (and `page.tsx` for route-local UI). `app/actions/controller.test.ts` is the root controller's router smoke test.
- `app/actions/document.tsx` renders the `<html>` shell: the `APP_NAME` title suffix, description, `noindex`, and optional social metadata. Pages pass `title`/`description` rather than writing `<head>` tags.
- `app/actions/home-page.tsx` renders the public welcome screen; the auth pages live in `app/actions/auth/` (login, register, verify, logout), and `app/actions/app/` owns the protected dashboard and settings pages.
- `app/actions/app/settings/profile/` owns `/app/settings` (identity summary and display-name form); `app/actions/app/settings/sessions/` owns `/app/settings/sessions` (Session list and revoke actions). Both render inside `AppShell`.
- `app/actions/app/clients/` owns `/app/clients`: the resource-builder route map (`resources` leaves plus the explicit `lifecycle/` map) and the controller owning the index/new/show/edit/create/update leaves, the `new/` and `edit/` form pages, the `lifecycle/` archive/restore actions (PUT), the shared `client-form.tsx` and `form-values.ts`, the field sections under `sections/`, the display primitives under `ui/` (panel, stat card, data table, status pill, page header — route-local because only this route map consumes them), and the read-only `contact-summary.tsx`, `billing-summary.tsx`, and `tax-summary.tsx` cards. Client pages render inside `AppShell` with the Clients nav destination current.
- `app/data/` owns the database (`db/` behind the stable `db.ts` entry, which re-exports the typed tables, relations, and row types and provides the `createAppDatabase` factory that server startup and scripts use to construct the connection; request handling receives the database through the request context and domain functions take it as an explicit first parameter; numbered SQL migrations live under `db/migrations/` and are applied by the single entry in `db/migrate.ts`, awaited by server startup before it listens and by the shared test bootstrap, which selects the in-memory test database explicitly), password hashing, display-name parsing (`display-name.ts`), and the Session (`session/`), Invoice (`invoices/`), and Organization (`organization/`) domain modules.
- `app/router.ts` exports the `createAppRouter({ db, sessionCookie, sessionStorage })` factory: the database is installed into the request context by `loadDatabase` middleware (`app/middleware/database.ts`), so controllers read `context.db`; server startup passes the application database, tests pass their own. The middleware stack also installs the method override so no-JS forms can submit PUT and DELETE.
- `app/middleware/` holds custom middleware (e.g. request context).
- `app/ui/` holds components shared by more than one route; route-local UI stays beside its controller. `app-shell.tsx` renders the authenticated document (sidebar, drawer, Dashboard/Clients/Settings destinations, settings subnavigation, identity, Log out) around page content; `auth-layout.tsx` renders the standalone public/auth card; `button`, `icon`, `field`, `input`, `select`, and `theme` are shared primitives; `identity.ts` bundles a User's email and display name and derives the display name-or-email label; `page-styles.ts` holds the shared page header, notice, form, footer, and text-link styles.
- `app/actions/public/` contains the browser runtime entry.
- Browser-shipped modules and shared browser-usable form schemas live in per-feature `public/` subfolders (`app/**/public/**` is the asset allow-list's browser-bundle boundary). Each form — auth, Client, Invoice draft, payment, refund, credit note, settings — is described once by a `public/schema.ts` module that drives both server-side parsing (`s.parseSafe` over `FormData`) and the browser input attributes through `app/ui/public/form-field.ts`; the status-400/repopulate/alert-role error contract is unchanged, and registration deliberately signs nobody in (the first authenticated Session is minted at login).
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and render middleware; the JSON-compatible mapping (root directory, allow and deny lists) lives in the `assets` block of `remix.json` and is loaded with `loadConfig`.
- Root `public/` contains static files served unchanged from the app root.
- `test/` holds cross-cutting request-flow tests and shared helpers. Every request-flow test builds its router through `test/router.ts`'s `createTestRouter()`: the app around its own in-memory database reset from the migrations and the seed baseline, a test-only session cookie, and hybrid session storage with a memory pre-login half; logins are real CSRF-scraping round trips (`loginAsDemoUser`, `createUserAndLogin`), never faked auth. `test/db-setup.ts`'s `testDb` serves data-module tests that never fetch.

Protect controllers with the shared `requireAuth()` from `app/middleware/auth.ts` rather than a path-prefix middleware; it sends anonymous visitors to login with their destination preserved in a sanitized `returnTo` parameter. Controller middleware does not flow into controllers mapped for nested route maps.

Organizing data modules, adding a schema migration, sharing types, choosing test seams (including the in-memory SQLite test configuration), and the advisory file-size review heuristic: follow `docs/agents/data-modules.md` — the single source of truth.
