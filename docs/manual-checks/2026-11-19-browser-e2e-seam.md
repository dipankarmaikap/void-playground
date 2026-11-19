# Manual check: browser e2e seam

This verifies the browser test seam (`npm run test:e2e`) on a checkout
where Playwright's browser binaries have not been installed yet. The seam
runs through the framework test runner (`remix test --type browser --type
e2e`) and needs the `playwright` devDependency plus its chromium binary;
plain `npm test` never launches a browser, so it stays runnable everywhere.

1. Confirm the plain server suite never requires a browser: temporarily
   rename the user's Playwright cache directory (or use a machine without
   binaries) and run the standard commands.

   ```sh
   npm test
   npm run typecheck
   npm run lint
   ```

   All three pass with no browser process started — `remix.json`'s
   `test.type` is `["server"]`.

2. Without the browser cache, the e2e command fails with Playwright's
   "Executable doesn't exist" error. Restore the cache (or install the
   binaries once per machine):

   ```sh
   npx playwright install chromium
   ```

3. Run the browser seam and check every file runs under the `chromium`
   project:

   ```sh
   npm run test:e2e
   ```

   It discovers the browser component tests (`app/ui/**/*.test.browser.tsx`)
   and the e2e flows (`test/*.test.e2e.ts`), reports `files 7 ... pass 19`
   (no failures), and exits `0`. The e2e output includes the verify URLs the
   register controller prints, as in development.

4. Re-run with a single boundary to confirm the filter flags still work:

   ```sh
   npm test -- --type e2e --project chromium
   npm run test:e2e -- auth-flow
   ```

   The first overrides the configured server-only default and runs just the
   two `test/*.test.e2e.ts` files (three tests) under `chromium`; the second
   filters the seam by name and runs the two auth-flow passes (JavaScript
   enabled and disabled).
