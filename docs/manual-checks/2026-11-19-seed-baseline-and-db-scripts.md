# Seed baseline and one-command database scripts

Recorded: 2026-11-19. Verified against commit range for ticket #68 (spec #67).

These checks verify the seeded baseline against the real server, not just the in-memory
data seam, because login and page rendering are the acceptance the seed exists for.

## One-command scripts

`package.json` wraps the installed `remix db` CLI (configuration lives in `remix.json`):

```sh
npm run db:migrate   # remix db migrate
npm run db:rollback  # remix db rollback
npm run db:seed      # remix db seed
npm run db:status    # remix db status
npm run db:reset     # remix db reset --force (wipe, migrate, then seed)
```

Stop any dev server before `db:reset`: a single process must own the database file, and on
Windows an open handle blocks the wipe.

## Verify the reset baseline end to end

1. `npm run db:reset` — ends with `database reset` and the full `0001..0015` migration list.
2. Confirm the seed ran by counting rows in `data/app.db` (one Organization with owner User,
   5 GST presets, 3 Clients, 3 Invoices with 5 lines, 1 payment, 2 PDF artifacts).
3. `npm run dev`, wait for `Server listening on http://localhost:44100`.
4. Load `http://localhost:44100/login`, submit the seeded demo account
   (`demo@meridian.test` / `demo-password`) with the page's CSRF token.
5. Expect `302` to `/app/dashboard`, and the dashboard to greet `Demo Owner`.
6. `/app/clients` lists Acme Retail Private Limited and Nirmala Sen (active) and
   Archway Media Private Limited (Archived).
7. `/app/invoices` lists `INV/26-27/0001` (Paid), `INV/26-27/0002` (Overdue), and the Draft
   retainer for Nirmala Sen.
8. `/app/invoices/seed-invoice-brand/pdf` returns `200 application/pdf` with the exact stored
   artifact bytes (`%PDF-1.4` header, ~5 KB).
9. Stop the server. The database file is disposable (ADR-0003): after any schema or hash-format
   change, delete `data/app.db` and rerun these steps.

## Regenerating the seeded PDF artifacts

The artifact hex in `app/data/db/seed.sql` is the exact `renderInvoicePdf()` output for the
seeded issued rows. If the seeded rows or the renderer change, regenerate before committing:

1. Temporarily remove the `invoice_pdf_artifacts` INSERT block from `seed.sql`.
2. Save this as a throwaway script (e.g. `tmp/print-seed-artifacts.ts`) and run it with
   `node --import remix/node-tsx tmp/print-seed-artifacts.ts`:

   ```ts
   import { fileURLToPath } from 'node:url';
   import { loadSeed } from 'remix/data-table/migrations/node';
   import { createSqliteDatabase } from 'remix/data-table/sqlite';
   import { migrateDatabase } from '../app/data/db/migrate.ts';
   import { invoiceLines, invoices } from '../app/data/db/tables.ts';
   import { renderInvoicePdf, sellerFromInvoiceSnapshot } from '../app/data/invoices/pdf.ts';

   let database = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
   await migrateDatabase(database);
   let seed = await loadSeed(fileURLToPath(new URL('../app/data/db/seed.sql', import.meta.url)));
   await seed(database);
   let issued = (await database.findMany(invoices))
     .filter((invoice) => invoice.status === 'issued');
   for (let invoice of issued) {
     let lines = await database.findMany(invoiceLines, {
       where: { invoice_id: invoice.id },
       orderBy: [['position', 'asc']],
     });
     let { internal_note: _privateNote, ...clientFacing } = invoice;
     let pdf = renderInvoicePdf({
       invoice: clientFacing,
       lines,
       seller: sellerFromInvoiceSnapshot(clientFacing),
       watermark: false,
     });
     console.log(`('seed-artifact-${invoice.id!.slice('seed-invoice-'.length)}', ` +
       `'${invoice.organization_id}', '${invoice.id}', X'${Buffer.from(pdf).toString('hex')}', ` +
       `${invoice.issued_at}, ${invoice.issued_at})`);
   }
   await database.close();
   ```

3. Wrap the printed tuples in the `insert or ignore into invoice_pdf_artifacts (...) values`
   statement, paste the block back into `seed.sql`, and re-run the checks above.
