import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { getTableReference } from 'remix/data-table';
import type { AnyTable } from 'remix/data-table';
import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';
import { loadMigrations } from 'remix/data-table/migrations/node';

import { CLIENT_TYPES } from '../client-names.ts';

import {
  clients,
  creditNotes,
  invoices,
  organizationMemberships,
  organizations,
  users,
} from './tables.ts';
import { appTables, migrationJournalTableName } from './compatibility.ts';
import { migrateDatabase, migrationsDirectory } from './migrate.ts';

/** Observes the resulting schema: does the named index exist right now? */
async function indexExists(database: SqliteDatabase, name: string): Promise<boolean> {
  let result = await database.exec(
    'SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?',
    ['index', name],
  );
  return (result.rows ?? []).length > 0;
}

/**
 * The migration behavior suite: every scenario goes through the single migration entry and
 * asserts observable outcomes — the resulting schema, rows read back through the typed table
 * API, backfilled values, and error messages.
 */
describe('migrateDatabase', () => {
  it('migrates an empty database to the complete final schema with typed round-trips', async () => {
    let freshDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(freshDb);

    for (let table of appTables) {
      assert.ok(
        await freshDb.hasTable(getTableReference(table)),
        `the final schema has the ${getTableReference(table).name} table`,
      );
    }

    // Columns that only exist because a historical migration step added them prove the full
    // history replayed, not a squashed baseline.
    let historicallyAddedColumns = [
      [users, 'display_name'],
      [invoices, 'net_subtotal_minor'],
      [invoices, 'gst_mode'],
      [invoices, 'supply_type'],
      [invoices, 'issued_at'],
      [creditNotes, 'invoice_discount_mode'],
    ] as Array<[AnyTable, string]>;
    for (let [table, column] of historicallyAddedColumns) {
      assert.ok(
        await freshDb.hasColumn(getTableReference(table), column),
        `the final schema has ${getTableReference(table).name}.${column}`,
      );
    }

    // Typed queries round-trip against the migrated schema.
    let now = Date.now();
    let userId = crypto.randomUUID();
    let email = `fresh-${crypto.randomUUID()}@example.com`;
    let organizationId = crypto.randomUUID();
    let clientId = crypto.randomUUID();
    await freshDb.create(users, {
      id: userId,
      email,
      email_verified: true,
      display_name: 'Fresh Install User',
      created_at: now,
    });
    await freshDb.create(organizations, {
      id: organizationId,
      name: 'Fresh Install Studio',
      created_at: now,
      updated_at: now,
    });
    await freshDb.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      is_owner: true,
      created_at: now,
    });
    await freshDb.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Fresh Install Client',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    let user = await freshDb.find(users, userId);
    assert.equal(user?.email, email);
    assert.equal(user?.display_name, 'Fresh Install User');
    let client = await freshDb.find(clients, clientId);
    assert.equal(client?.type, 'business');
    assert.equal(client?.legal_name, 'Fresh Install Client');
    let organization = await freshDb.find(organizations, organizationId);
    assert.equal(organization?.name, 'Fresh Install Studio');

    await freshDb.close();
  });

  it('applies nothing on a second run because the journal owns run-once', async () => {
    let freshDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    let firstRun = await migrateDatabase(freshDb);
    let migrations = await loadMigrations(migrationsDirectory);
    assert.equal(firstRun.applied.length, migrations.length, 'the first run applies every migration');

    let secondRun = await migrateDatabase(freshDb);
    assert.equal(secondRun.applied.length, 0, 'a fully journaled database replays no migration');
    assert.equal(secondRun.sql.length, 0, 'no migration script runs a second time');

    await freshDb.close();
  });

  it('detects an edited applied migration through checksum drift', async () => {
    let freshDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(freshDb);

    // The runner compares each journaled checksum against the current migration file, so an
    // edited up.sql after application surfaces as a mismatch; plant the mismatch on the
    // journal side, which the untouched files then disagree with.
    await freshDb.executeScript(
      `UPDATE ${migrationJournalTableName} SET checksum = 'rewritten-history' WHERE id = '0003'`,
    );

    let rejected = false;
    let message = '';
    try {
      await migrateDatabase(freshDb);
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }
    assert.equal(rejected, true, 'history rewriting must fail loudly');
    assert.match(message, /checksum drift/);
    assert.match(message, /"0003"/, 'the error names the drifted migration');

    await freshDb.close();
  });

  it('reverts the last reversible migration step on rollback', async () => {
    let freshDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(freshDb);
    assert.ok(
      await indexExists(freshDb, 'idx_clients_organization_status'),
      'the final schema keeps the Client directory index fast',
    );

    let rollback = await migrateDatabase(freshDb, { direction: 'down', step: 1 });
    assert.equal(rollback.reverted.length, 1, 'a bounded rollback reverts exactly one step');
    assert.equal(rollback.reverted[0]?.id, '0015');
    assert.equal(
      await indexExists(freshDb, 'idx_clients_organization_status'),
      false,
      'the reverted step leaves no schema behind',
    );

    // The journal recorded the revert, so a forward run re-applies exactly that step.
    let rerun = await migrateDatabase(freshDb);
    assert.equal(rerun.applied.length, 1);
    assert.equal(rerun.applied[0]?.id, '0015');
    assert.ok(await indexExists(freshDb, 'idx_clients_organization_status'));

    await freshDb.close();
  });

  it('reports irreversible migration steps instead of rolling them back', async () => {
    let freshDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await migrateDatabase(freshDb);

    // Bounded rollback to the tax-rate rebuild, whose reversal has no meaningful down step.
    let rejected = false;
    let message = '';
    try {
      await migrateDatabase(freshDb, {
        direction: 'down',
        to: '0006_invoice_tax_rate_constraints',
      });
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }
    assert.equal(rejected, true, 'rolling back through an irreversible step fails loudly');
    assert.match(message, /no down script/);
    assert.match(message, /"0006"/, 'the error names the irreversible migration');

    // The runner vetoes the whole rollback before executing any of it.
    assert.ok(
      await indexExists(freshDb, 'idx_clients_organization_status'),
      'nothing was reverted by the rejected rollback',
    );
    let rerun = await migrateDatabase(freshDb);
    assert.equal(rerun.applied.length, 0, 'the journal still holds every applied migration');

    await freshDb.close();
  });

  it('rejects a pre-Organization legacy database before any migration SQL runs', async () => {
    let legacyDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await legacyDb.executeScript(`
      CREATE TABLE clients (id TEXT PRIMARY KEY NOT NULL, legal_name TEXT NOT NULL);
      INSERT INTO clients (id, legal_name) VALUES ('legacy-client', 'Preserved Legacy Client');
    `);

    let rejected = false;
    let message = '';
    try {
      await migrateDatabase(legacyDb);
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }
    assert.equal(rejected, true, 'a pre-Organization schema fails closed');
    assert.match(message, /operator-managed clean start/);

    let preservedClient = await legacyDb.exec('SELECT legal_name FROM clients');
    assert.equal(preservedClient.rows?.[0]?.legal_name, 'Preserved Legacy Client');
    let migratedTables = await legacyDb.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'organizations'",
    );
    assert.equal(
      (migratedTables.rows ?? []).length,
      0,
      'no migration SQL ran against the rejected database',
    );

    await legacyDb.close();
  });

  it('keeps the migration CHECK list synchronized with the canonical Client types', async () => {
    let migrations = await loadMigrations(migrationsDirectory);
    let clientsCreate = migrations.find((migration) => /create table clients\b/i.test(migration.up));
    assert.ok(clientsCreate, 'a migration creates the clients table');
    let checkList = /CHECK \(type IN \(([^)]*)\)\)/.exec(clientsCreate.up);
    assert.ok(checkList, 'the clients table declares its Client-type CHECK list');
    for (let type of CLIENT_TYPES) {
      assert.ok(
        checkList[1]?.includes(`'${type}'`),
        `adding the Client type '${type}' requires a migration that extends the CHECK list`,
      );
    }
  });
});
