# Data modules and maintainability

The canonical guide for organizing `app/data/` modules, owning types, choosing test seams, adding a schema migration, and reviewing file size. Other docs link here; don't restate these rules elsewhere.

## Group modules by domain

- Put modules in a domain folder when several of them share a domain and repeated prefixes hurt discovery. Don't create a folder for an isolated one-off module.
- Directories organize related modules; they never merge behavior or add pass-through re-export modules. Distinct responsibilities stay distinct modules, each with its own useful interface.
- Split only on independent reasons to change, clearer ownership, or better locality — never to satisfy a naming pattern.

Worked examples on this branch:

- `app/data/db/` — `connection.ts`, `tables.ts` (typed declarations plus `beforeWrite`/`validate` hooks owning write-time normalization and invariants), `relations.ts` (has-many/belongs-to query descriptors), `row-types.ts` behind the stable `app/data/db.ts` entry, which owns the app-facing table, relation, and row-type contract and the `createAppDatabase` factory that server startup and scripts call to construct the application database; no instance lives there. `migrate.ts` is the single migration entry (the numbered SQL migrations, applied by the Remix runner) awaited by server startup before it listens and by the shared test bootstrap; `migrations/` holds the numbered SQL migration directories the Remix runner applies; `seed.sql` is the idempotent baseline data (`insert or ignore` throughout) that `remix db seed`, `remix db reset`, and the colocated seed test run against a caller-chosen database. Databases are disposable build-phase artifacts (ADR-0003): the remedy for a stale or unrecognized dev database is deleting the file, never compatibility code.
- `app/data/session/` — `setup.ts` (cookie/scheme), `storage.ts` (hybrid cookie/SQLite storage built per database), `auth-payload.ts` (canonical authenticated payload).
- `app/data/invoices/` — parsing (`draft.ts`), persistence (`records.ts`), issuance (`issuance.ts`), payments and refunds (`payments.ts`, `refunds.ts`, `money-movements.ts`), rendering (`pdf.ts`, `pdf-artifacts.ts`), and the shared cross-document modules (`documents.ts`, `document-numbers.ts`, `pdf-filenames.ts`).
- `app/data/organization/` — `access.ts`, `name.ts`, `invoicing.ts`, `gst-presets.ts`: one domain, four distinct responsibilities.

## The database is injected, never imported as a singleton

- No request-handling or domain module imports a database instance. The database reaches request handling through the router: `createAppRouter({ db, ... })` installs it into the request context with `loadDatabase` middleware (router-level, so controllers of nested route maps see `context.db` too), controllers read it from `context.db`, and domain data functions take it as an explicit first parameter — no defaulted database parameters. The session auth scheme reads it from the request context, and hybrid session storage is constructed per database inside the router factory.
- The stable entry `app/data/db.ts` owns the typed table and row-type contract and the `createAppDatabase` factory. Server startup and scripts construct the application database through it (`createAppDatabase()` → `migrateDatabase(db)` → `createAppRouter({ db })`); the connection module contains no test-mode branch.
- Tests select their database explicitly: the shared bootstrap `test/db-setup.ts` creates an in-memory database through the same adapter (`createSqliteDatabase({ filename: ':memory:', foreignKeys: true })`), awaits `migrateDatabase(testDb)` at module load, and exports `testDb` plus `clearTestTables`. A test that needs a router builds one through `createAppRouter({ db: testDb })`.

## Adding a migration

- A schema change is one new directory in `app/data/db/migrations/` named `<NNNN>_<slug>` with the next 4-digit prefix; every prefix shares that width so directory sort is apply order. `up.sql` is required; add `down.sql` when the change is meaningfully reversible, dropping added columns, indexes, and tables in reverse dependency order. Omit `down.sql` for irreversible steps — the runner reports those as irreversible (see `0006_invoice_tax_rate_constraints`).
- Write the migration as its historical step, not the final shape: fresh installs and legacy upgrades replay identical history and end at the same schema. Plain one-shot SQL — the journal owns run-once, so no `IF NOT EXISTS` or has-column guards.
- Keep `app/data/db/tables.ts` aligned: the typed table declarations stay the app-facing contract, and each table's `beforeWrite`/`validate` hooks are the typed layer's first line of defense for write-time normalization and per-operation invariants — the migration CHECK/GLOB constraints remain the last line of defense and are never removed from the SQL. Relation descriptors live in `app/data/db/relations.ts` and only load related rows; the SQL foreign keys stay the enforcement. The Client-type CHECK list is inlined in the migration SQL with a comment naming its canonical source (`app/data/client-names.ts`), and a dedicated test reads the migration SQL to keep the two synchronized.
- The runner wraps each migration in a transaction automatically. A parent-table rebuild that toggles `PRAGMA foreign_keys` must instead start its `up.sql` with `-- data-table/transaction: none` (see `0004`, `0005`, and `0007`): SQLite ignores that PRAGMA inside a transaction, so the default wrapping would leave foreign keys enforced mid-rebuild.
- DDL lives only in migration files; untrusted values go only through the parameterized `sql` tag. Never run migrations outside the single entry: server startup and `test/db-setup.ts` both await it. The `remix db` CLI reads `remix.json` and the same migrations; its verification steps are recorded in `docs/manual-checks/`.

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
- Data behavior: pass the database explicitly — import `testDb` from `test/db-setup.ts` (its module load creates the in-memory database and applies the real migration history through the single entry) and hand it to the domain function under test; its `clearTestTables(...tables)` cleans between tests. Never bootstrap a schema or clean up with hand-written SQL in a test file. Never test against `data/app.db`; never leak state across test files.
- Request behavior: use `router.fetch` request-flow tests (see `test/`), building the router through `createAppRouter({ db: testDb })` so the whole stack — session scheme, hybrid storage, controllers — runs on the caller-chosen database.
- Don't test private helpers or internal SQL arrangement unless a persistence invariant specifically requires it.

## File-size review prompts

- Around 500 lines in an authored source file: a review prompt. Ask whether the file still has one cohesive responsibility.
- Around 1,000 lines: a strong prompt — document why the file remains cohesive, or split it.
- These are advisory signals, not a cap. Never a lint rule, never a CI failure. Line count alone never requires a split.
- Split on independent reasons to change, not on size. A large but focused module (for example `app/data/db/tables.ts`, one cohesive set of typed table declarations) is fine.
- Apply the same judgment to tests; long integration scenarios are legitimate.

## When to write an ADR

- Add an ADR only for a hard-to-reverse, surprising decision with a real trade-off.
- Never write an ADR for folder layout or the file-size heuristic.
- Existing ADRs stay authoritative for their decisions; this guide does not fold them in: `docs/adr/0001-hybrid-session-storage.md`, `docs/adr/0002-organization-access.md`.
