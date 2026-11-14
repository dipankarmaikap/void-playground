import { and, eq, ilike, or } from 'remix/data-table';
import type { Predicate } from 'remix/data-table';

import type { ClientType } from './client-names.ts';
import type { ClientStatus } from './client-status.ts';
import { clients, db } from './db.ts';
import type { Client } from './db.ts';

export type ClientTypeFilter = ClientType | 'all';

export interface ClientListFilter {
  /** Case-insensitive substring matched against names and contact channels. */
  q?: string;
  /** `all` keeps both Individual and Business Clients. */
  type?: ClientTypeFilter;
  /** Defaults to active Clients so archived records stay out of the directory. */
  status?: ClientStatus;
}

const SEARCH_FIELDS = [
  'legal_name',
  'preferred_name',
  'trading_name',
  'email',
  'phone',
  'contact_email',
  'contact_phone',
] as const;

const LIKE_WILDCARDS = /[%_]/;

/**
 * Returns the shared Client book, active Clients by default.
 *
 * Search never touches tax identifiers, lifecycle status, industry, or address columns.
 * Percent and underscore are LIKE wildcards, and the SQLite data-table driver compiles
 * `ilike` without an `ESCAPE` clause, so queries containing them fall back to a literal
 * case-insensitive substring match after the status and type predicates run.
 */
export async function listClients(filter: ClientListFilter = {}): Promise<Client[]> {
  let status = filter.status ?? 'active';
  let type = filter.type ?? 'all';
  let q = filter.q?.trim() ?? '';

  let predicates: Predicate[] = [eq(clients.status, status)];
  if (type !== 'all') predicates.push(eq(clients.type, type));

  let literalSearch = q !== '' && LIKE_WILDCARDS.test(q);
  if (q && !literalSearch) {
    let pattern = `%${q}%`;
    predicates.push(or(...SEARCH_FIELDS.map((field) => ilike(clients[field], pattern))));
  }

  let clientsInView = await db.findMany(clients, {
    where: and(...predicates),
    orderBy: [['legal_name', 'asc']],
  });

  if (!literalSearch) return clientsInView;
  return clientsInView.filter((client) => matchesClientQuery(client, q));
}

function matchesClientQuery(client: Client, q: string): boolean {
  let needle = q.toLowerCase();
  return SEARCH_FIELDS.some((field) => client[field]?.toLowerCase().includes(needle));
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
