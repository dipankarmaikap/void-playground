import { getTableReference } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import {
  clients,
  creditNoteLines,
  creditNotePdfArtifacts,
  creditNotes,
  documentSequences,
  invoiceLines,
  invoicePayments,
  invoicePdfArtifacts,
  invoiceRefunds,
  invoices,
  organizationGstRatePresets,
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
  sessions,
  userPasswords,
  users,
} from './tables.ts';

/** The migration runner's journal table, created by the first migration run. */
export const migrationJournalTableName = 'data_table_migrations';

/**
 * Every typed app table, in one list. The journal gate rejects a database that already holds
 * any of them without the migration journal, and the migration suite asserts the fresh-install
 * schema contains them all — so adding a table touches `tables.ts`, a migration, and this list.
 */
export const appTables = [
  clients,
  creditNoteLines,
  creditNotePdfArtifacts,
  creditNotes,
  documentSequences,
  invoiceLines,
  invoicePayments,
  invoicePdfArtifacts,
  invoiceRefunds,
  invoices,
  organizationGstRatePresets,
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
  sessions,
  userPasswords,
  users,
];

function missingClientOrganizationSchemaError(): Error {
  return new Error(
    'This database schema is missing required Client Organization ownership. ' +
      'Stop the app and perform the operator-managed clean start before continuing. ' +
      'No stored data was deleted.',
  );
}

function predatesMigrationJournalError(): Error {
  return new Error(
    'This database schema predates the file-based migration journal. ' +
      'Stop the app and perform the operator-managed clean start before continuing. ' +
      'No stored data was deleted.',
  );
}

/** Rejects a persisted pre-Organization Client schema before startup creates any new tables. */
export async function assertClientSchemaCompatible(database: SqliteDatabase): Promise<void> {
  let clientTable = getTableReference(clients);
  if (
    (await database.hasTable(clientTable)) &&
    !(await database.hasColumn(clientTable, 'organization_id'))
  ) {
    throw missingClientOrganizationSchemaError();
  }
}

/**
 * Rejects a database that already holds app tables but no migration journal. The migration
 * runner owns schema application, so such a database was written by the old hand-rolled
 * pipeline (or by hand); reject it before the runner re-runs history against it and crashes
 * on CREATE TABLE. Adopting the runner means the operator-managed clean start, per
 * docs/adr/0002-organization-access.md.
 */
export async function assertJournaledSchema(database: SqliteDatabase): Promise<void> {
  if (!(await database.hasTable({ name: migrationJournalTableName }))) {
    for (let table of appTables) {
      if (await database.hasTable(getTableReference(table))) {
        throw predatesMigrationJournalError();
      }
    }
  }
}

/**
 * Rejects a database whose identity data is not Organization-owned: either a `clients` table
 * without `organization_id`, or any User with no Organization membership.
 *
 * The `organization_id` check intentionally repeats `assertClientSchemaCompatible` above: that one
 * guards the pre-schema-creation lifecycle stage, this one the post-creation stage, so the
 * repetition is deliberate, not a merge candidate.
 */
export async function assertOrganizationSchemaCompatible(
  database: SqliteDatabase,
): Promise<void> {
  let clientsHaveOrganization = await database.hasColumn(
    getTableReference(clients),
    'organization_id',
  );
  if (!clientsHaveOrganization) {
    throw missingClientOrganizationSchemaError();
  }

  let [existingUsers, memberships] = await Promise.all([
    database.findMany(users),
    database.findMany(organizationMemberships),
  ]);
  let membershipCounts = new Map<string, number>();
  for (let membership of memberships) {
    membershipCounts.set(
      membership.user_id,
      (membershipCounts.get(membership.user_id) ?? 0) + 1,
    );
  }
  let hasUnassociatedUsers = existingUsers.some(
    (user) => (membershipCounts.get(user.id) ?? 0) === 0,
  );
  if (hasUnassociatedUsers) {
    throw new Error(
      'This database contains identity or Client data without Organization ownership. ' +
        'Stop the app and perform the operator-managed clean start before continuing. ' +
        'No stored data was deleted.',
    );
  }
}
