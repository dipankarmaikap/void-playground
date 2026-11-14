# App UI, Profile, and Sessions Implementation Plan

**Goal:** Give the app a coherent light-first UI, an optional User display name, and a minimal authenticated shell that houses the dashboard and Session settings.

**Spec:** `docs/specs/2026-11-14-app-ui-design.md`

## Global Constraints

- No new dependencies; icons are inline Lucide SVG paths rendered by a shared component.
- One `APP_NAME` value in `app/config.ts` drives branding and metadata.
- Public home and auth pages stay indexable; authenticated pages are `noindex`.
- Keep the existing authentication, Email Verification, CSRF, and Session semantics.
- Use `routes.*.href()` for every link, form action, and redirect.
- Tests are request-level through `router.fetch` with the in-memory SQLite database; no CSS-class assertions or browser automation.

---

## Task 1: Public home and auth UI (#2)

**Files:** `app/config.ts`, `app/actions/document.tsx`, `app/actions/home-page.tsx`, `app/actions/auth/login/{controller.tsx,page.tsx}`, `app/actions/auth/register/{controller.tsx,page.tsx}`, `app/ui/{auth-layout,button,field,input,theme}.tsx`

- [x] Add `APP_NAME = 'My Remix App'` and a `Document` component that owns the title suffix, description, `noindex`, and social-preview metadata.
- [x] Build a distinct public welcome screen with register and login actions; authenticated Users keep the same page plus a dashboard link.
- [x] Put login and registration in a shared centered card layout with links between the flows.
- [x] Keep registration optional display-name input, Email Verification, and the existing verification wording.

## Task 2: Authenticated shell and Session settings (#3)

**Files:** `app/actions/app/routes.ts`, `app/actions/app/controller.tsx`, `app/actions/app/dashboard-page.tsx`, `app/actions/app/settings/profile/{controller.tsx,page.tsx}`, `app/actions/app/settings/sessions/{controller.tsx,page.tsx}`, `app/ui/app-shell.tsx`

- [x] Add the `/app/settings` Profile and `/app/settings/sessions` Sessions route pair with typed hrefs.
- [x] Render the shell as a skip link, a no-JS `<details>` drawer, a sidebar, and a main region.
- [x] Keep Dashboard and Settings as the only main destinations. Settings opens Profile, and the Profile/Sessions subnavigation renders only inside Settings.
- [x] Show the User identity and a CSRF-protected Log out form in the sidebar footer.
- [x] Give the dashboard a greeting and two shortcuts, with no invented metrics or activity.
- [x] Move the existing Session list, current-Session marker, single Revoke, and confirmed bulk Revoke into the shell without changing server behavior.

## Task 3: Display name (#4)

**Files:** `app/config.ts`, `app/data/db.ts`, `app/data/display-name.ts`, `app/actions/app/settings/profile/*`, `app/actions/auth/register/*`, `app/ui/identity.ts`

- [x] Add nullable `display_name` to the `users` table and migrate existing databases with a guarded `ALTER TABLE`.
- [x] Parse display names in one module: trim, treat blank as unset, enforce `DISPLAY_NAME_MAX_LENGTH`.
- [x] Accept the optional value during registration and let Profile update or clear it through a CSRF-protected form.
- [x] Keep the submitted value in a single flash key when validation fails.
- [x] Show the display name with the email beneath it, falling back to the email when unset.

## UI Shell Decisions

- The sidebar is static at `min-width: 48rem` and a slide-out drawer below it.
- Navigation labels stay visible next to icons; `aria-current="page"` marks the exact destination and `data-active` carries the visual state.
- The Settings main link opens Profile, so it is visually active for both Profile and Sessions.
- All metadata comes from `Document`; pages pass a title and description only.

## Metadata Decisions

- Title format is `<Page> | <APP_NAME>`; pages never hard-code the product name.
- Home, login, and registration are indexable; the home page also emits Open Graph and Twitter summary metadata.
- Dashboard, Profile, and Sessions set `noindex`.

## Display Name Decisions

- The display name is optional and non-unique; it is never an authentication identifier.
- Blank input clears the value to `null`; existing Users stay valid.
- The app greets with the display name when present and otherwise uses the email address.

## Sessions Decisions

- `/app/settings/sessions` keeps the existing hybrid Session storage, ownership checks, and revoke behavior.
- The current Session has no row-level Revoke control; it ends through Log out.
- Revoking all other Sessions uses a `<details>` confirmation so it works without JavaScript.

## Testing Strategy

- Router-level tests cover anonymous and authenticated home behavior, auth metadata, registration, verification, and login.
- App controller tests cover protected redirects, shell navigation, Profile rendering and updates, display-name persistence and fallback, Session details, Revoke, and Log out.
- `test/http.ts` provides shared CSRF-aware form submission, User creation, and login helpers.
- Responsive layout is checked manually at desktop and mobile widths; no browser automation.

## Out of Scope

- Real verification-email delivery or an email provider.
- Password reset/change, email change, User deletion, avatars, or unique usernames.
- Dashboard metrics, activity feeds, or marketing claims.
- Dark mode, React, `lucide-react`, or another icon dependency.
- Browser-test infrastructure, sitemaps, canonical URLs, or social-preview images.
- Changes to authentication, Email Verification, CSRF, Session storage, or Session ownership semantics.
