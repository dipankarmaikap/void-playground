# Client Management Implementation Plan

**Goal:** Add a global, shared Clients book to the authenticated app: create, view, edit, search, filter, archive, and restore Individual and Business profiles with contact, billing, and tax details.

**Spec:** `docs/specs/2026-11-14-client-management-design.md` (issue #5)

**Research notes:** `C:\Users\Dipankar Maikap\AppData\Local\Temp\opencode\client-management-research\notes.md` (Remix 3 APIs, app conventions, and parallel-work seams).

## Global Constraints

- One global Client book. Client records have no owner column, workspace, role, or membership model. Every authenticated User can read and mutate every Client.
- A Client is not a User: no credentials, Sessions, invitations, or login flow.
- Put the route group under `/app/clients`; protect every Client controller with `requireAuth()` and redirect anonymous GET requests to login. `requireAuth()` must be declared on each nested controller because controller middleware does not cascade.
- Use `routes.*.href()` for every link, form action, and redirect.
- Reuse the app's CSRF-protected form pattern and accessible `role="alert"` / `role="status"` feedback. Retain submitted values when validation fails.
- Render every Client page in `AppShell`, so authenticated pages stay `noindex` and carry route-specific titles and descriptions.
- No new dependencies. No financial ledgers, invoices, payments, tax calculations, or government lookups.
- Tests are request-level through `router.fetch` with the in-memory SQLite database and the shared `test/http.ts` helpers. No CSS-class assertions or browser automation.

## Ticket Graph

Native blockers, as recorded on GitHub:

```
#6  Individual profiles (foundation)
 └─ #7  Business profiles + type switching
     ├─ #8  Contact details
     ├─ #9  Tax identifiers
     ├─ #10 Archive and restore
     └─ #11 Billing details
         (#12 needs #8 and #10)
#12 Search and filter
```

`#6` starts immediately. `#7` follows it. `#8`, `#9`, `#10`, and `#11` then run in parallel. `#12` follows `#8` and `#10`.

## Foundation (#6)

### Routes and controllers

Use explicit `get`/`post`/`form` leaves; do not use `resources()` because it emits PUT/DELETE and this app has no `methodOverride()` middleware. Split the route map so each nested map owns a controller directory, as `AGENTS.md` requires:

```ts
// app/actions/app/clients/routes.ts
export const clientRoutes = route({
  index: get('/'),                 // GET  /app/clients
  new: form('/new'),               // GET+POST /app/clients/new
  show: get('/:clientId'),         // GET  /app/clients/:clientId
  edit: form('/:clientId/edit'),   // GET+POST /app/clients/:clientId/edit
  lifecycle: route('/:clientId', { // #10 adds the leaf actions here
    archive: post('/archive'),
    restore: post('/restore'),
  }),
});
```

Compose as `clients: route('/clients', clientRoutes)` in `app/actions/app/routes.ts`. Map four controllers in `app/router.ts`: `routes.app.clients` (`index`, `show`), `.new` (`index`, `action`), `.edit` (`index`, `action`), and `.lifecycle` (`archive`, `restore`, added by #10). Each controller redeclares `requireAuth()`.

Use `form()` for `new` and `edit` so the existing `postForm()` test helper works unchanged. `GET /clients/new` wins over `/:clientId` by route specificity.

### Data shape

Add a `clients` table to `app/data/db.ts` with the complete nullable shape the spec needs, so later tickets add behavior rather than repeated schema migrations. New rows start `status = 'active'`; always pass `status`, `created_at`, and `updated_at` explicitly because `db.create` does not apply column defaults. Add a guarded `hasColumn`/`ALTER TABLE` loop for later nullable columns so existing databases stay valid. Add non-unique indexes for `status`, `type`, and `tax_value`.

- Identity: `id`, `type` (`individual` | `business`), `legal_name`, `preferred_name`, `trading_name`, `industry`.
- Contacts: `email`, `phone`, `contact_name`, `contact_role`, `contact_email`, `contact_phone`.
- Billing: `billing_line1`, `billing_locality`, `billing_region`, `billing_postal_code`, `billing_country`, `billing_currency`.
- Tax: `tax_country`, `tax_type`, `tax_value`, `tax_state_name`, `tax_state_code`.
- Lifecycle: `status` (`active` | `archived`), `archived_at`, `created_at`, `updated_at`.

Keep names and contact values non-unique. Represent `type` and `status` as text/enum, not booleans.

### Files

- `app/data/clients.ts` — Client row types, display label, create/update/find/list operations, and the status filter. Keep request orchestration out of this module.
- `app/data/client-names.ts` — type and name parsing/validation; display-label rule.
- `app/actions/app/clients/routes.ts` — nested route map.
- `app/actions/app/clients/controller.tsx` — directory (`index`) and read-only profile (`show`).
- `app/actions/app/clients/index-page.tsx` — directory listing, extended by #12.
- `app/actions/app/clients/show-page.tsx` — profile view.
- `app/actions/app/clients/new/{controller.tsx,page.tsx}` — create form and action.
- `app/actions/app/clients/edit/{controller.tsx,page.tsx}` — edit form and action.
- `app/actions/app/clients/client-form.tsx` + `form-values.ts` — shared form composition and submitted-value types.
- `app/actions/app/clients/sections/profile-fields.tsx` — type and name fields (#6/#7).
- `app/actions/app/clients/sections/registry.ts` — append-only list of field sections. Each later ticket adds one import and one array entry.
- `app/actions/app/clients/controller.test.ts` — foundation request-flow tests.
- `app/ui/app-shell.tsx` + `app/ui/icon.tsx` — add a Clients destination and a `users` icon; add `archive` for #10.
- `app/ui/select.tsx` + `app/ui/textarea.tsx` — shared primitives, created once in #6.
- `test/http.ts` — add a page→action CSRF helper for POST-only lifecycle routes.

### Form and validation seam

Render one profile edit form containing all field sections. Each section in `sections/registry.ts` parses its own `FormData` and returns submitted values, column changes, and field issues. The shared controller folds over the registry, so later tickets do not edit the controllers:

- Validation failure re-renders the form with HTTP 400, submitted values, page-level `role="alert"`, and per-field errors.
- Success updates the Client, flashes a `role="status"` message, and redirects (profile after edit, new profile after create).
- Unknown Client ids return 404.
- Render both type-specific field groups; hide the inactive one with `hidden`, never `disabled`, so hidden values still submit and type changes preserve them.

### Behavior

- Required: type and legal name. Preferred name is optional. Display label is preferred name when set, otherwise legal name.
- Directory defaults to Active records and shows the display label, type, and useful contact information.
- New Clients start Active; every authenticated User sees the same records.

## Ticket Notes

### #7 Business profiles and type switching

- Business legal name is required; trading name and industry are optional free text.
- Display label is trading name when set, otherwise legal name.
- Allow changing type on edit. Preserve values for fields hidden by the new type (business-only contacts/industry and the other type's name field) by keeping both groups in the form.
- Own `sections/business-fields.tsx` or extend `profile-fields.tsx`; add `business.test.ts`.

### #8 Contact details

- Individual: optional email and phone.
- Business: optional shared email and phone plus one optional primary contact. If any primary-contact field is present, the name is required; role/email/phone stay optional.
- Basic email and international phone format checks only; no verification.
- Duplicate values across Clients are allowed.
- Own `app/data/client-contacts.ts` and `sections/contact-fields.tsx`; append one import/entry to the registry.
- Add `contacts.test.ts`.

### #9 Tax identifiers

- One optional identifier per Client row: country, type, value, plus State/UT name and code for India GSTIN/UIN.
- Basic format checks only; missing means unknown, not unregistered.
- Warn when the same identifier exists on another Client, but save anyway.
- Never search the directory by tax identifier.
- Own `app/data/client-tax.ts` (+ State/UT data) and `sections/tax-fields.tsx`.
- Add `tax.test.ts`.

### #10 Archive and restore

- New Clients start Active. Archive preserves the row; never hard-delete.
- Archived records are hidden from the default directory and visible in the archived view.
- Restore returns a Client to Active.
- CSRF-protected forms with accessible feedback; works for both types.
- Own `app/data/client-status.ts`, `sections/status-controls.tsx`, and `lifecycle/controller.tsx`; add `archive`/`restore` to the lifecycle map and `app/router.ts`; extend the directory/status UI.
- Add `lifecycle.test.ts`.

### #11 Billing details

- Zero or one current billing address. When present, address line 1 and country are required; locality, region/State, and postal code are optional.
- Zero or one default billing currency. Suggest a currency from the billing country when known, but keep the value editable; allow a manual currency without an address.
- No multiple addresses/currencies, exchange rates, or conversion.
- Own `app/data/client-billing.ts` (+ country/currency data) and `sections/billing-fields.tsx`.
- Add `billing.test.ts`.

### #12 Search and filter

- Search legal/preferred/trading names, Client email/phone, and primary-contact email/phone. Do not search tax identifiers.
- Filters: type (all/individual/business) and status (active/archived).
- Search and filters combine against the global book; show a useful empty state.
- Keep the directory in the responsive shell and authenticated.
- Extend `app/data/clients.ts`, `index-page.tsx`, and the directory action; add `search.test.ts`.

## Shared-File Rules for Parallel Tickets

- Branch from the integration branch; merge its tip before reporting done.
- Prefer new files per ticket (data module, section component, test file). Touch shared files additively and minimally: one route entry, one registry entry, one section render line.
- Preserve both sides when resolving conflicts; run `npm test`, `npm run typecheck`, and `npm run lint` before reporting.

## Testing Strategy

- Foundation: anonymous redirects, create/view/edit an Individual, display-label fallback, shared access by a second User, persistence, CSRF rejection, validation feedback, `noindex`, page metadata, navigation.
- Each later ticket adds its own router-level test file covering its acceptance criteria, including persistence and second-User access where relevant.
- Use the in-memory DB per test file; give every Client a unique name. Assert containment rather than exact counts where earlier tests may have inserted rows.
- CSRF runs before auth, so anonymous mutating POSTs without a token return 403; anonymous GETs redirect to login.
- Responsive layout is checked manually at desktop and mobile widths; no browser automation.

## Out of Scope

Everything listed under "Out of Scope" in the spec: Client accounts, per-User books, financial ledgers, invoices, multiple tax IDs/addresses/contacts, government validation, currency conversion, hard deletion, and search by tax identifier.
