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

/** Archives a Client in place, keeping every profile field. */
export async function archiveClient(id: string): Promise<Client> {
  let now = Date.now();
  return db.update(clients, id, {
    status: 'archived',
    archived_at: now,
    updated_at: now,
  });
}

/** Returns an archived Client to Active and clears the archive timestamp. */
export async function restoreClient(id: string): Promise<Client> {
  return db.update(clients, id, {
    status: 'active',
    archived_at: null,
    updated_at: Date.now(),
  });
}
