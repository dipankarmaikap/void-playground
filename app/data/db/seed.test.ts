import { fileURLToPath } from 'node:url';

import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { getTableReference } from 'remix/data-table';
import { loadSeed } from 'remix/data-table/migrations/node';
import { createSqliteDatabase } from 'remix/data-table/sqlite';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { verifyPassword } from '../password.ts';
import { migrateDatabase } from './migrate.ts';
import {
  clients,
  documentSequences,
  invoiceLines,
  invoicePayments,
  invoicePdfArtifacts,
  invoices,
  organizationGstRatePresets,
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
  userPasswords,
  users,
} from './tables.ts';

/** The idempotent baseline data file, resolved from this module like the migrations directory. */
const seedFile = fileURLToPath(new URL('./seed.sql', import.meta.url));

/** The seeded demo account, documented in seed.sql alongside its pre-hashed password. */
const SEED_EMAIL = 'demo@meridian.test';
const SEED_PASSWORD = 'demo-password';

/** Every table the seed writes, in a stable order for exact before/after comparisons. */
const SEEDED_TABLES = [
  users,
  userPasswords,
  organizations,
  organizationMemberships,
  organizationInvoicingProfiles,
  organizationGstRatePresets,
  clients,
  invoices,
  invoiceLines,
  documentSequences,
  invoicePayments,
  invoicePdfArtifacts,
];

/** The seed contract is behavior against a caller-chosen database, same as the migration entry. */
async function createSeededDatabase(): Promise<SqliteDatabase> {
  let database = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
  await migrateDatabase(database);
  let seed = await loadSeed(seedFile);
  await seed(database);
  return database;
}

describe('seed', () => {
  it('provisions a complete Organization with Clients and Invoices across lifecycle states', async () => {
    let database = await createSeededDatabase();

    let organization = (await database.findMany(organizations))[0];
    assert.ok(organization, 'the seed provisions an Organization');
    assert.equal(organization.name, 'Meridian Design Studio');

    let membership = (
      await database.findMany(organizationMemberships, {
        where: { organization_id: organization.id },
      })
    )[0];
    assert.ok(membership, 'the seeded User owns the Organization through a membership');
    assert.equal(membership.is_owner, true);

    let user = await database.findOne(users, { where: { email: SEED_EMAIL } });
    assert.ok(user, 'the seed provisions the demo User');
    assert.equal(user.email_verified, true, 'the demo User can sign in immediately');
    assert.equal(user.display_name, 'Demo Owner');

    let profile = await database.find(organizationInvoicingProfiles, organization.id);
    assert.ok(profile, 'the Organization has an invoicing profile');
    assert.equal(profile?.address_country, 'IN');

    assert.equal(
      (await database.findMany(organizationGstRatePresets)).length,
      5,
      'the Organization starts with the default GST rate presets',
    );

    let seededClients = await database.findMany(clients);
    assert.equal(seededClients.length, 3);
    assert.equal(
      seededClients.filter((client) => client.status === 'archived').length,
      1,
      'the Client directory shows both active and archived entries',
    );

    let seededInvoices = await database.findMany(invoices);
    let drafts = seededInvoices.filter((invoice) => invoice.status === 'draft');
    let issued = seededInvoices.filter((invoice) => invoice.status === 'issued');
    assert.equal(drafts.length, 1, 'the seed includes a Draft invoice');
    assert.equal(issued.length, 2, 'the seed includes issued documents');
    assert.ok(
      drafts.every((invoice) => invoice.invoice_number === null && invoice.issued_at === null),
      'a Draft never carries an issue number or timestamp',
    );
    assert.ok(
      issued.every(
        (invoice) => invoice.invoice_number !== null && invoice.invoice_number !== '',
      ),
      'every issued document carries its number',
    );

    let lines = await database.findMany(invoiceLines);
    for (let invoice of seededInvoices) {
      let invoiceLineCount = lines.filter((line) => line.invoice_id === invoice.id).length;
      assert.ok(invoiceLineCount > 0, `the invoice ${invoice.id} has at least one service line`);
    }

    let payments = await database.findMany(invoicePayments);
    assert.equal(payments.length, 1, 'one issued invoice is recorded as paid');
    let paidInvoice = await database.find(invoices, payments[0]!.invoice_id);
    assert.ok(paidInvoice);
    assert.equal(
      payments[0]!.amount_minor,
      paidInvoice!.total_minor,
      'the payment settles its invoice in full',
    );

    let sequence = (await database.findMany(documentSequences))[0];
    assert.ok(sequence, 'issuing consumed the Organization document sequence');
    let highestIssuedNumber = Math.max(
      ...issued.map((invoice) => Number(invoice.invoice_number!.split('/').pop())),
    );
    assert.equal(sequence.current_number, highestIssuedNumber);

    for (let invoice of issued) {
      let artifact = await database.findOne(invoicePdfArtifacts, {
        where: { invoice_id: invoice.id },
      });
      assert.ok(artifact, `the issued invoice ${invoice.invoice_number} has its stored PDF`);
      let bytes = artifact?.data as Uint8Array | undefined;
      assert.ok(bytes && bytes.length > 0, 'the stored PDF carries bytes');
    }

    await database.close();
  });

  it('seeding twice never duplicates data', async () => {
    let database = await createSeededDatabase();
    let countsBefore = new Map(
      await Promise.all(
        SEEDED_TABLES.map(
          async (table): Promise<[string, number]> => [
            getTableReference(table).name,
            (await database.findMany(table)).length,
          ],
        ),
      ),
    );

    let seed = await loadSeed(seedFile);
    await seed(database);

    for (let table of SEEDED_TABLES) {
      assert.equal(
        (await database.findMany(table)).length,
        countsBefore.get(getTableReference(table).name),
        `seeding twice leaves ${getTableReference(table).name} unchanged`,
      );
    }
    await database.close();
  });

  it('stores the demo password under the app password scheme', async () => {
    let database = await createSeededDatabase();
    let user = await database.findOne(users, { where: { email: SEED_EMAIL } });
    assert.ok(user);
    let credentials = await database.find(userPasswords, user!.id);
    assert.ok(credentials, 'the demo User has stored password credentials');

    assert.equal(await verifyPassword(SEED_PASSWORD, credentials!.password_hash), true);
    assert.equal(await verifyPassword('wrong-password', credentials!.password_hash), false);

    await database.close();
  });
});
