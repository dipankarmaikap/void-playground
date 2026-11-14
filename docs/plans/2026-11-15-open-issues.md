# Open Issue Completion Plan

**Goal:** Resolve all fourteen open GitHub issues #13–#26 on the current
`main` branch.

**Spec:** `docs/specs/2026-11-15-open-issues-design.md`

## Work Sequence

1. **Authentication and request boundaries (#13, #14, #15, #16, #18, #23)**
   - Add GET/POST verification actions and router-flow coverage.
   - Add explicit public-origin/proxy configuration and test the real Node
     request adapter, cookies, CSRF origin, and generated verification links.
   - Apply private no-store headers to authenticated HTML without changing
     public-page or asset caching.
   - Await Session-row deletion on Log out and verify User-scoped listing and
     Revoke behavior.
   - Route asset requests ahead of Session/Auth middleware and retain the
     allowlist boundary.
   - Make `/` GET-only and verify GET, HEAD, and unsupported methods.
2. **Runtime lifecycle and browser recovery (#17, #19)**
   - Extract a testable shutdown boundary, drain in-flight requests for a
     configurable grace period, force-close remaining connections, and report
     cleanup failures.
   - Report original browser runtime errors and expose a one-step recovery
     action. Record and perform the manual browser check.
3. **Client validation and directory (#20, #21, #24, #26)**
   - Share parsing/aggregation between create and edit and make form-value
     types complete.
   - Enforce and document limits for every free-text field; preserve invalid
     submissions and stored data.
   - Validate GSTIN State/UT consistency.
   - Add stable, bounded, projected directory pages and preserve filters in
     navigation.
4. **Documentation (#22, #25)**
   - Refresh browser entry metadata on watched changes and permit only the
     shared route contract's browser-safe dependency graph.
   - Update the README and document manual HMR verification.

## TDD and Validation

- Use the seams recorded in the design; confirm each behavior with a failing
  request or adapter test before the minimal implementation.
- Run focused test files and `npm run typecheck` after each vertical slice.
- Run `npm test`, `npm run typecheck`, and `npm run lint` after the complete
  implementation.
- Manually verify browser runtime recovery and development HMR/import-map
  refresh without introducing browser-test infrastructure.
- Review all implementation changes against the original `main` baseline,
  address findings, then comment on and close each completed GitHub issue.

## Commits

- Commit this design and plan before implementation begins.
- Commit implementation on the current `main` branch using Conventional
  Commits; do not create a separate branch.
