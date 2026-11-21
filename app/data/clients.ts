import { and, eq, ilike, inList, or } from 'remix/data-table';
import type { Predicate } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import type { ClientType } from './client-names.ts';
import type { ClientStatus } from './client-status.ts';
import { clients } from './db.ts';
import type { Client } from './db.ts';

export type ClientTypeFilter = ClientType | 'all';

export const CLIENT_DIRECTORY_PAGE_SIZE = 20;
const CLIENT_DIRECTORY_SCAN_BATCH_SIZE = 100;
// SQLite bounds the number of bound parameters per statement; batch id allow-lists to stay under it.
const CLIENT_ID_BATCH_SIZE = 500;

export type ClientDirectoryItem = Pick<
  Client,
  | 'id'
  | 'type'
  | 'legal_name'
  | 'preferred_name'
  | 'trading_name'
  | 'industry'
  | 'email'
  | 'phone'
  | 'contact_email'
  | 'contact_phone'
>;

export interface ClientDirectoryPage {
  clients: ClientDirectoryItem[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  /** Clients matching the whole filter, before pagination. */
  total: number;
}

export interface ClientListFilter {
  /** Case-insensitive substring matched against names and contact channels. */
  q?: string;
  /** `all` keeps both Individual and Business Clients. */
  type?: ClientTypeFilter;
  /** Defaults to active Clients so archived records stay out of the directory. */
  status?: ClientStatus;
  /** One-based page number; invalid values fall back to page 1. */
  page?: number;
  /** Optional allow-list of Client ids applied before pagination (e.g. a follow-up view). */
  clientIds?: readonly string[];
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

const DIRECTORY_COLUMNS = {
  id: clients.id,
  type: clients.type,
  legal_name: clients.legal_name,
  preferred_name: clients.preferred_name,
  trading_name: clients.trading_name,
  industry: clients.industry,
  email: clients.email,
  phone: clients.phone,
  contact_email: clients.contact_email,
  contact_phone: clients.contact_phone,
};

/**
 * Returns one stable page from the current Organization's Client book, active Clients by default.
 * Any `clientIds` allow-list is applied with the other predicates, before pagination, so `total`
 * and the navigation flags describe the filtered set rather than the unfiltered book.
 *
 * Search never touches tax identifiers, lifecycle status, industry, or address columns.
 * Percent and underscore are LIKE wildcards, and the SQLite data-table driver compiles
 * `ilike` without an `ESCAPE` clause. Queries containing those characters are therefore
 * matched literally in bounded batches after status and type predicates run.
 */
export async function listClients(
  db: SqliteDatabase,
  organizationId: string,
  filter: ClientListFilter = {},
): Promise<ClientDirectoryPage> {
  let status = filter.status ?? 'active';
  let type = filter.type ?? 'all';
  let q = filter.q?.trim() ?? '';
  let page = normalizePage(filter.page);
  let offset = (page - 1) * CLIENT_DIRECTORY_PAGE_SIZE;

  let predicates: Predicate[] = [
    eq(clients.organization_id, organizationId),
    eq(clients.status, status),
  ];
  if (type !== 'all') predicates.push(eq(clients.type, type));

  if (filter.clientIds !== undefined) {
    if (filter.clientIds.length === 0) {
      return { clients: [], page, hasPrevious: page > 1, hasNext: false, total: 0 };
    }
    let idPredicates: Predicate[] = [];
    for (let index = 0; index < filter.clientIds.length; index += CLIENT_ID_BATCH_SIZE) {
      idPredicates.push(
        inList(clients.id, filter.clientIds.slice(index, index + CLIENT_ID_BATCH_SIZE)),
      );
    }
    predicates.push(or(...idPredicates));
  }

  let literalSearch = q !== '' && LIKE_WILDCARDS.test(q);
  if (q && !literalSearch) {
    let pattern = `%${q}%`;
    predicates.push(or(...SEARCH_FIELDS.map((field) => ilike(clients[field], pattern))));
  }

  let base = db.query(clients).where(and(...predicates));
  let ordered = base
    .select(DIRECTORY_COLUMNS)
    .orderBy('legal_name', 'asc')
    .orderBy('id', 'asc');

  if (!literalSearch) {
    let [total, rows] = await Promise.all([
      base.count(),
      ordered.limit(CLIENT_DIRECTORY_PAGE_SIZE).offset(offset).all(),
    ]);
    return {
      clients: rows,
      page,
      hasPrevious: page > 1,
      hasNext: offset + rows.length < total,
      total,
    };
  }

  let matches: ClientDirectoryItem[] = [];
  let scanned = 0;
  while (true) {
    let batch = await ordered.limit(CLIENT_DIRECTORY_SCAN_BATCH_SIZE).offset(scanned).all();
    if (batch.length === 0) break;
    for (let client of batch) {
      if (matchesClientQuery(client, q)) matches.push(client);
    }
    scanned += batch.length;
    if (batch.length < CLIENT_DIRECTORY_SCAN_BATCH_SIZE) break;
  }

  return {
    clients: matches.slice(offset, offset + CLIENT_DIRECTORY_PAGE_SIZE),
    page,
    hasPrevious: page > 1,
    hasNext: offset + CLIENT_DIRECTORY_PAGE_SIZE < matches.length,
    total: matches.length,
  };
}

export function parseClientDirectoryPage(value: string | null): number {
  if (value == null || !/^\d+$/.test(value)) return 1;
  return normalizePage(Number(value));
}

function normalizePage(page: number | undefined): number {
  if (
    page == null ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / CLIENT_DIRECTORY_PAGE_SIZE)
  ) {
    return 1;
  }
  return page;
}

function matchesClientQuery(client: ClientDirectoryItem, q: string): boolean {
  let needle = q.toLowerCase();
  return SEARCH_FIELDS.some((field) => client[field]?.toLowerCase().includes(needle));
}

export async function findClient(
  db: SqliteDatabase,
  organizationId: string,
  id: string,
): Promise<Client | null> {
  return db.findOne(clients, { where: { id, organization_id: organizationId } });
}

/** Inserts a Client into the given Organization. New Clients always start Active. */
export async function createClient(
  db: SqliteDatabase,
  organizationId: string,
  values: Omit<Partial<Client>, 'organization_id'>,
): Promise<Client> {
  let now = Date.now();
  return db.create(
    clients,
    {
      ...values,
      id: values.id ?? crypto.randomUUID(),
      organization_id: organizationId,
      status: values.status ?? 'active',
      archived_at: values.archived_at ?? null,
      created_at: values.created_at ?? now,
      updated_at: values.updated_at ?? now,
    },
    { returnRow: true },
  );
}

/** Updates only a Client in the given Organization, always refreshing `updated_at`. */
export async function updateClient(
  db: SqliteDatabase,
  organizationId: string,
  id: string,
  changes: Omit<Partial<Client>, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
): Promise<Client | null> {
  let safeChanges = { ...changes } as Partial<Client>;
  delete safeChanges.id;
  delete safeChanges.organization_id;
  delete safeChanges.created_at;
  delete safeChanges.updated_at;

  await db.updateMany(
    clients,
    { ...safeChanges, updated_at: Date.now() },
    { where: { id, organization_id: organizationId }, limit: 1 },
  );
  return findClient(db, organizationId, id);
}
