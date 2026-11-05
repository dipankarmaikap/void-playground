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

Designs and plans live under `docs/`:

- `docs/specs/YYYY-MM-DD-<topic>-design.md` — the validated design, written before any code
- `docs/plans/YYYY-MM-DD-<feature-name>.md` — the implementation plan

One feature is one spec plus one plan; specs and plans are committed before implementation starts.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`, e.g. `feat(auth): add session cookie`. Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Summary in lowercase, imperative, no trailing period; add a body only when the why is not obvious.

## App Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs. Use `routes.*.href()` in links, forms, and redirects instead of string literals.
- `app/router.ts` wires routes to controllers and installs the middleware stack: request context, async context, static files, session, form data, CSRF, auth, CSP, render.
- `hmr.ts` supervises the development server for `npm run hmr`, proxying requests while server and browser modules reload.
- Authored `<script>` and `<style>` tags need the request nonce from `getCspNonce(getContext())`; import maps, module preloads, and `css()` styles get it from `render()` automatically.
- Put top-level route actions in `app/actions/controller.tsx`; give every nested route map its own directory with `controller.tsx` (and `page.tsx` for route-local UI). `app/actions/controller.test.ts` is the root controller's router smoke test.
- `app/actions/auth/` owns login, register, verify, and logout. `app/actions/app/` owns the protected dashboard and settings pages.
- `app/data/` owns SQLite tables, password hashing, the hybrid session storage, and session cookie/scheme setup (`session.ts`).
- `app/middleware/` holds custom middleware (e.g. request context).
- `app/ui/` holds components shared by more than one route; route-local UI stays beside its controller.
- `app/actions/home-page.tsx` and `app/actions/document.tsx` render the route-owned starter UI.
- `app/actions/public/` contains the browser runtime entry.
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and render middleware.
- Root `public/` contains static files served unchanged from the app root.
- `test/` holds cross-cutting request-flow tests and shared helpers.

Protect controllers with `requireAuth()` rather than a path-prefix middleware; controller middleware does not flow into controllers mapped for nested route maps.

Tests use an in-memory SQLite database when `NODE_ENV=test`, so they never touch `data/app.db` and do not leak state across test files.
