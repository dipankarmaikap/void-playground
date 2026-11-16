import { clients, db } from './db.ts';
import type { Client } from './db.ts';

/**
 * Lifecycle state of a Client.
 *
 * Clients are archived in place and never hard-deleted, so `archived_at` records when
 * the Client was archived.
 */
export type ClientStatus = Client['status'];

/**
 * Parses the directory's `status` query parameter.
 * Only an explicit `archived` leaves the default Active view.
 */
export function parseClientStatusFilter(value: unknown): ClientStatus {
  return value === 'archived' ? 'archived' : 'active';
}

/** Archives a Client in place only when it belongs to the given Organization. */
export async function archiveClient(
  organizationId: string,
  id: string,
): Promise<Client | null> {
  let now = Date.now();
  await db.updateMany(
    clients,
    {
      status: 'archived',
      archived_at: now,
      updated_at: now,
    },
    { where: { id, organization_id: organizationId }, limit: 1 },
  );
  return db.findOne(clients, { where: { id, organization_id: organizationId } });
}

/** Returns an archived Client to Active only within the given Organization. */
export async function restoreClient(
  organizationId: string,
  id: string,
): Promise<Client | null> {
  await db.updateMany(
    clients,
    {
      status: 'active',
      archived_at: null,
      updated_at: Date.now(),
    },
    { where: { id, organization_id: organizationId }, limit: 1 },
  );
  return db.findOne(clients, { where: { id, organization_id: organizationId } });
}
