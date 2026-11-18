# Data modules and maintainability

The canonical guide for organizing `app/data/` modules, owning types, choosing test seams, and reviewing file size. Other docs link here; don't restate these rules elsewhere.

## Group modules by domain

- Put modules in a domain folder when several of them share a domain and repeated prefixes hurt discovery. Don't create a folder for an isolated one-off module.
- Directories organize related modules; they never merge behavior or add pass-through re-export modules. Distinct responsibilities stay distinct modules, each with its own useful interface.
- Split only on independent reasons to change, clearer ownership, or better locality — never to satisfy a naming pattern.

Worked examples on this branch:

- `app/data/db/` — `connection.ts`, `tables.ts`, `row-types.ts`, `schema.ts`, `migrations.ts`, `compatibility.ts` behind the stable `app/data/db.ts` entry, which creates one database instance and runs initialization and migrations in an explicit order.
- `app/data/session/` — `setup.ts` (cookie/scheme), `storage.ts` (hybrid cookie/SQLite storage), `auth-payload.ts` (canonical authenticated payload).
- `app/data/invoices/` — parsing (`draft.ts`), persistence (`records.ts`), issuance (`issuance.ts`), payments and refunds (`payments.ts`, `refunds.ts`, `money-movements.ts`), rendering (`pdf.ts`, `pdf-artifacts.ts`), and the shared cross-document modules (`documents.ts`, `document-numbers.ts`, `pdf-filenames.ts`).
- `app/data/organization/` — `access.ts`, `name.ts`, `invoicing.ts`, `gst-presets.ts`: one domain, four distinct responsibilities.

## Own types semantically

- Each domain module owns its semantically meaningful types. Reuse a type when its meaning and invariants are the same.
- Keep types distinct when domain or lifecycle meaning differs. Fields that currently look alike are not a reason to unify.
- Never add a pass-through re-export module to share a type; import from the owner.

Examples on this branch:

- Kept distinct: `app/data/organization/invoicing.ts` keeps `InvoicingProfileInput` (form input), `InvoicingProfileValues` (normalized), and `InvoicingProfileView` (display) separate contracts despite overlapping fields.
- Consolidated: `app/data/invoices/document-numbers.ts` owns one document-number allocation implementation (`DocumentSequenceType`, `DocumentSequenceConfig`) for both Invoice and Credit Note issuance, while each document keeps its specific configuration and errors.

## Test behavior at module interfaces

- Assert observable behavior through the highest useful seam. A test must survive internal reorganization of the module it covers.
- Direct module tests for focused deterministic behavior: `app/data/invoices/draft.test.ts` asserts minor-unit amounts, totals, and validation outcomes through `parseInvoiceDraft`, not through internal helpers.
- Data behavior: use the in-memory SQLite adapter (`NODE_ENV=test` swaps the database to `:memory:`). Never test against `data/app.db`; never leak state across test files.
- Request behavior: use `router.fetch` request-flow tests (see `test/`).
- Don't test private helpers or internal SQL arrangement unless a persistence invariant specifically requires it.

## File-size review prompts

- Around 500 lines in an authored source file: a review prompt. Ask whether the file still has one cohesive responsibility.
- Around 1,000 lines: a strong prompt — document why the file remains cohesive, or split it.
- These are advisory signals, not a cap. Never a lint rule, never a CI failure. Line count alone never requires a split.
- Split on independent reasons to change, not on size. A large but focused module (for example `app/data/db/schema.ts`, one cohesive set of schema declarations) is fine.
- Apply the same judgment to tests; long integration scenarios are legitimate.

## When to write an ADR

- Add an ADR only for a hard-to-reverse, surprising decision with a real trade-off.
- Never write an ADR for folder layout or the file-size heuristic.
- Existing ADRs stay authoritative for their decisions; this guide does not fold them in: `docs/adr/0001-hybrid-session-storage.md`, `docs/adr/0002-organization-access.md`.
