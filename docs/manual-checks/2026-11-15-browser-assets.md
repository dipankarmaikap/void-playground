# Manual check: browser asset graph and HMR refresh

This verifies the development browser module graph without adding browser-test
infrastructure.

1. Start `npm run hmr` and open `/` in a browser. In DevTools Network, confirm
   the document's import map and module preloads load successfully.
2. Confirm the browser graph can load `/assets/app/routes.ts` and its route-map
   dependencies, including `app/actions/app/routes.ts` and
   `app/actions/app/clients/routes.ts`.
3. Confirm unrelated server modules remain unavailable: requests for
   `/assets/app/actions/app/clients/controller.tsx` and
   `/assets/app/data/clients.ts` should not return source code.
4. Add a temporary module under `app/actions/public/`, import it from
   `app/actions/public/entry.ts`, and use one of its exports so it stays in the
   browser graph. Save the files while the HMR server is running.
5. Wait for the server/browser update, then refresh the document. Confirm its
   import map and module preloads now include the temporary module and that
   the module loads successfully.
6. Remove the temporary import and file; confirm the next refreshed document
   no longer references that module.

Do not commit the temporary probe. The app allowlist intentionally exposes the
shared route contract and route-map modules, not controllers, data modules, or
tests.
