import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { createAppDatabase } from './db/connection.ts';

export {
  users,
  organizations,
  organizationInvoicingProfiles,
  organizationGstRatePresets,
  organizationMemberships,
  userPasswords,
  sessions,
  clients,
  invoices,
  documentSequences,
  invoicePdfArtifacts,
  invoicePayments,
  invoiceRefunds,
  invoiceLines,
  creditNotes,
  creditNoteLines,
  creditNotePdfArtifacts,
} from './db/tables.ts';

export type {
  User,
  Organization,
  OrganizationInvoicingProfile,
  OrganizationGstRatePreset,
  OrganizationMembership,
  UserPassword,
  SessionRow,
  Client,
  Invoice,
  InvoiceLine,
  InvoicePdfArtifact,
  InvoicePayment,
  InvoiceRefund,
  CreditNote,
  CreditNoteLine,
  CreditNotePdfArtifact,
} from './db/row-types.ts';

/**
 * The application's single database instance. Importing this module creates the connection only:
 * schema application lives in `./db/migrate.ts`, awaited by server startup before it listens and
 * by the shared test bootstrap, so no request or test ever sees a half-migrated schema. The
 * database is a disposable build-phase artifact (ADR-0003): the documented remedy for a stale
 * or unrecognized dev database is deleting the file and restarting.
 *
 * The re-exported tables and row types above are the app-facing contract blessed by
 * docs/agents/data-modules.md: query code stays unaffected by how the schema is applied.
 */
export const db: SqliteDatabase = createAppDatabase();
