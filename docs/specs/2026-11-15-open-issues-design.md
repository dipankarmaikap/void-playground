# Open Issue Completion Design

Date: 2026-11-15

## Problem Statement

Fourteen ready-for-agent issues remain open on `main` (#13–#26). They cover
Email Verification safety, deployment origin handling, private response caching,
Session reliability, graceful shutdown, asset routing, browser recovery, Client
form consistency and validation, directory pagination, browser asset freshness,
the home route's method contract, and outdated README content.

## Solution

Implement the acceptance criteria in issues #13–#26 while preserving the app's
existing route, security, domain, and UI conventions. Keep protected-page tests
at the `router.fetch` boundary with the in-memory SQLite database. Test Node
adapter behavior through a real listener on an ephemeral port and browser asset
behavior through the asset server's public APIs. Do not add browser-test
infrastructure.

## Decisions

- Treat each issue's acceptance criteria as the feature contract; this batch
  design does not expand their scope.
- Email Verification is read-only on GET and mutates only through its
  CSRF-protected POST action. Keep invalid, expired, and reused-token feedback
  accessible.
- Production origin handling is explicit. A canonical public origin may be
  configured; alternatively, forwarded origin headers are honored only behind
  an explicitly trusted proxy. Verification links must use the configured
  canonical origin or the request origin reconstructed in that explicitly
  trusted mode. Session cookies must be Secure for HTTPS production requests.
- Authenticated `/app` HTML is `private, no-store`. Public pages and asset
  responses keep their existing cache behavior.
- Session destruction must await deletion of the server-side row. Session
  listing and revocation remain scoped to the authenticated User.
- Shutdown first stops accepting requests, drains active requests for a
  configurable grace period, then closes remaining connections and owned
  resources exactly once. Any cleanup failure is reported and produces a
  failing process exit status.
- Asset requests are handled before Session/Auth middleware; the existing
  asset allowlist remains narrow and excludes tests and server-only modules.
- Browser runtime failures are reported with the original error and expose an
  app-owned recovery path. Verify the recovery manually rather than adding a
  browser test framework.
- Client create/edit use one section aggregation contract. `ClientFormValues`
  accurately requires every field populated by its builders.
- Every free-text Client field has a documented server-side length limit.
  Over-limit values are rejected, never truncated, and remain available for
  accessible correction.
- Client free-text limits are: legal/preferred/trading names 120; industry
  120; email and contact email 254; phone and contact phone 40; contact name
  120; contact role 100; tax country 100; tax type 40; tax value 128; billing
  line 1 200; billing locality, region, and country 100 each; billing postal
  code 32; and billing currency 3 characters. Type and State/UT code are
  enumerated fields, not free text.
- India GSTIN submissions must agree with the selected State/UT code.
- Client directory results use a default page size of 20, stable ordering, and
  only list-required fields. Search, type, and status filters survive
  pagination.
- Development asset-entry metadata is refreshed after watched graph changes.
  Browser modules may import the shared route contract and its browser-safe
  dependencies without broadening access to unrelated application code.
- Restrict `/` to GET (with the router's normal HEAD behavior) and update the
  README to describe the current routes and features.
- Do not add dependencies, browser automation, government-service calls, or
  unrelated product behavior.

## Test Seams

- `router.fetch` plus in-memory SQLite: auth, Session, cache, method, and Client
  request/response and persistence behavior. This does not verify actual browser
  hydration or a deployed reverse proxy.
- The Node request listener on an ephemeral port: proxy-origin handling and
  graceful/forced shutdown. This verifies the adapter and connection lifecycle,
  not the deployment proxy's configuration.
- Asset-server fetch/metadata APIs: source reachability, import-map/preload
  refresh, and allowlist boundaries. Live HMR remains a manual check.
- Browser runtime error handling: test the public reporting/recovery seam and
  document a manual browser check; no browser-test infrastructure is introduced.
- README: review the feature and route descriptions against the route contract.

## Issue Coverage

- #13: explicit POST Email Verification.
- #14: trusted HTTPS proxy or canonical public origin.
- #15: prevent caching personalized HTML.
- #16: reliable Log out and User-scoped Session operations.
- #17: drain in-flight requests on shutdown.
- #18: serve assets without Session/Auth database lookups.
- #19: report browser runtime errors and provide recovery.
- #20: share Client form parsing and aggregation.
- #21: limit Client free-text fields.
- #22: update README routes and features.
- #23: restrict the public home route to GET.
- #24: keep GSTIN and State/UT consistent.
- #25: keep the browser asset graph fresh and importable.
- #26: paginate the Client directory.
