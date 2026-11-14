import type { Client } from './db.ts';
import { clientDisplayLabel } from './client-names.ts';
import { clients, db } from './db.ts';

export type ClientStatus = Client['status'];

export interface ClientListFilter {
  /** Defaults to active Clients so archived records stay out of the directory. */
  status?: ClientStatus;
}

/** Returns the shared Client book, active Clients by default. */
export async function listClients(filter: ClientListFilter = {}): Promise<Client[]> {
  return db.findMany(clients, {
    where: { status: filter.status ?? 'active' },
    orderBy: [['legal_name', 'asc']],
  });
}

export async function findClient(id: string): Promise<Client | null> {
  return db.find(clients, id);
}

/** Inserts a Client into the global book. New Clients always start Active. */
export async function createClient(values: Partial<Client>): Promise<Client> {
  let now = Date.now();
  return db.create(
    clients,
    {
      ...values,
      id: values.id ?? crypto.randomUUID(),
      status: values.status ?? 'active',
      archived_at: values.archived_at ?? null,
      created_at: values.created_at ?? now,
      updated_at: values.updated_at ?? now,
    },
    { returnRow: true },
  );
}

/** Updates a Client, always refreshing `updated_at`. Throws when the row is missing. */
export async function updateClient(
  id: string,
  changes: Partial<Client>,
): Promise<Client> {
  return db.update(clients, id, { ...changes, updated_at: Date.now() });
}

export function clientDisplayName(client: Client): string {
  return clientDisplayLabel(client);
}
