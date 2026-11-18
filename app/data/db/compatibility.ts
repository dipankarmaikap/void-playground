import { getTableReference } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { clients, organizationMemberships, users } from './tables.ts';

function missingClientOrganizationSchemaError(): Error {
  return new Error(
    'This database schema is missing required Client Organization ownership. ' +
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
 * Rejects a database whose identity data is not Organization-owned: either a `clients` table
 * without `organization_id`, or any User with no Organization membership.
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
