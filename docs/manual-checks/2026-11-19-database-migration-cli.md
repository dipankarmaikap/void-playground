# Manual check: database migration CLI

This verifies the `remix db` CLI against the app's migration set without
request-flow or browser infrastructure. `remix.json` points the CLI at the
app's real database by default, so every command below must run with
`--connection-env` naming a scratch file outside the repo's `data/`
directory — never `data/app.db`.

1. Pick a scratch path outside `data/` (for example in the OS temp
   directory) and check a fresh file: every migration reports `pending`.

   ```sh
   export REMIX_DB_SCRATCH="<scratch path outside the repo's data/>"
   npx remix db status --connection-env REMIX_DB_SCRATCH
   ```

2. Plan without applying. The installed CLI supports `--dry-run` on
   `rollback` only — `remix db migrate --dry-run` fails with
   `RMX_UNKNOWN_ARGUMENT` — so the migrate plan goes through the host API's
   `dryRun` option. Save this to a temp script outside the repo and run it
   from the repo root:

   ```ts
   import { loadMigrations } from 'remix/data-table/migrations/node';
   import { createSqliteDatabase } from 'remix/data-table/sqlite';

   const scratch = process.env.REMIX_DB_SCRATCH;
   if (!scratch) throw new Error('Set REMIX_DB_SCRATCH to the scratch database path.');
   const database = createSqliteDatabase({ filename: scratch, foreignKeys: true });
   const migrations = await loadMigrations('./app/data/db/migrations');
   const plan = await database.migrate(migrations, { dryRun: true });
   console.log(`pending: ${plan.applied.length}, planned scripts: ${plan.sql.length}`);
   database.close();
   ```

   ```sh
   node --import remix/node-tsx <temp script path>
   ```

   It prints `pending: 15, planned scripts: 15` (one entry per migration),
   and a repeat of step 1 still reports every migration `pending` — the
   plan touched nothing.

3. Apply for real, then confirm the journal:

   ```sh
   npx remix db migrate --connection-env REMIX_DB_SCRATCH
   npx remix db status --connection-env REMIX_DB_SCRATCH
   ```

   `migrate` prints `applied <NNNN>_<name>` for every migration; `status`
   now reports every migration `applied`.

4. Plan a bounded rollback:

   ```sh
   npx remix db rollback --dry-run --connection-env REMIX_DB_SCRATCH
   ```

   It prints `would revert 0015_clients_organization_status_index` (the
   newest migration) and changes nothing: a following `status` still reports
   every migration `applied`. Real rollbacks stay bounded the same way with
   `--step <count>` or `--to <NNNN>_<name>`; reverting a step that has no
   `down.sql` (such as `0006_invoice_tax_rate_constraints`, deliberately
   irreversible) fails instead of reverting.

5. Delete the scratch database file and the temp script. Do not commit
   either, and never run `remix db wipe` or `remix db reset` against the
   app's database.
