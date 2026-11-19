export { createAppDatabase } from './db/connection.ts';

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
 * The stable entry for the application database: it owns the typed table and row-type contract
 * and the factory server startup and scripts use to construct the application database. No
 * instance lives here — request handling receives the database through the request context, and
 * domain modules take it as an explicit parameter (see docs/agents/data-modules.md).
 *
 * Schema application lives in `./db/migrate.ts`, awaited by server startup before it listens
 * and by the shared test bootstrap, so no request or test ever sees a half-migrated schema.
 */
