import type { SqliteDatabase } from 'remix/data-table/sqlite';

import * as compatibility from './db/compatibility.ts';
import { createAppDatabase, isTest } from './db/connection.ts';
import * as migrations from './db/migrations.ts';
import * as schema from './db/schema.ts';

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
 * The application's single database instance. Importing this module creates it and runs the
 * schema, migrations, and compatibility checks below in one explicit order; startup fails closed
 * rather than upgrading a database that predates Organization ownership.
 */
export const db: SqliteDatabase = createAppDatabase();

if (!isTest) {
  await compatibility.assertClientSchemaCompatible(db);
}

await schema.applyFreshInstallSchema(db);
await migrations.migrateInvoiceDiscountColumns(db);
await migrations.migrateInvoiceTaxColumns(db);
await migrations.migrateInvoiceExtendedTaxColumns(db);
await migrations.migrateInvoiceTaxRateConstraints(db);
await migrations.migrateInvoiceIssueColumns(db);
await schema.applyInvoicePaymentSchema(db);
await schema.applyInvoiceRefundSchema(db);
await schema.applyCreditNoteSchema(db);
await migrations.migrateCreditNoteDiscountModeColumn(db);
await migrations.migrateUserDisplayNameColumn(db);
await migrations.migrateClientColumns(db);
await migrations.migrateInvoicingProfileColumns(db);

if (!isTest) {
  await compatibility.assertOrganizationSchemaCompatible(db);
}

await schema.createClientsOrganizationStatusIndex(db);

/** Rejects a persisted pre-Organization Client schema before startup creates any new tables. */
export async function assertClientSchemaCompatible(
  database: SqliteDatabase = db,
): Promise<void> {
  await compatibility.assertClientSchemaCompatible(database);
}

/** Rejects a database whose identity data is not Organization-owned. */
export async function assertOrganizationSchemaCompatible(
  database: SqliteDatabase = db,
): Promise<void> {
  await compatibility.assertOrganizationSchemaCompatible(database);
}

export async function migrateInvoiceDiscountColumns(
  database: SqliteDatabase = db,
): Promise<void> {
  await migrations.migrateInvoiceDiscountColumns(database);
}

export async function migrateInvoiceTaxColumns(database: SqliteDatabase = db): Promise<void> {
  await migrations.migrateInvoiceTaxColumns(database);
}

export async function migrateInvoiceExtendedTaxColumns(
  database: SqliteDatabase = db,
): Promise<void> {
  await migrations.migrateInvoiceExtendedTaxColumns(database);
}

export async function migrateInvoiceTaxRateConstraints(
  database: SqliteDatabase = db,
): Promise<void> {
  await migrations.migrateInvoiceTaxRateConstraints(database);
}

export async function migrateInvoiceIssueColumns(
  database: SqliteDatabase = db,
): Promise<void> {
  await migrations.migrateInvoiceIssueColumns(database);
}
