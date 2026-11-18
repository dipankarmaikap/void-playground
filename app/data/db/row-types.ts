import type { TableRow } from 'remix/data-table';

import type {
  clients,
  creditNoteLines,
  creditNotePdfArtifacts,
  creditNotes,
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

export type User = TableRow<typeof users>;
export type Organization = TableRow<typeof organizations>;
export type OrganizationInvoicingProfile = TableRow<typeof organizationInvoicingProfiles>;
export type OrganizationGstRatePreset = TableRow<typeof organizationGstRatePresets>;
export type OrganizationMembership = TableRow<typeof organizationMemberships>;
export type UserPassword = TableRow<typeof userPasswords>;
export type SessionRow = TableRow<typeof sessions>;
export type Client = TableRow<typeof clients>;
export type Invoice = TableRow<typeof invoices>;
export type InvoiceLine = TableRow<typeof invoiceLines>;
export type InvoicePdfArtifact = TableRow<typeof invoicePdfArtifacts>;
export type InvoicePayment = TableRow<typeof invoicePayments>;
export type InvoiceRefund = TableRow<typeof invoiceRefunds>;
export type CreditNote = TableRow<typeof creditNotes>;
export type CreditNoteLine = TableRow<typeof creditNoteLines>;
export type CreditNotePdfArtifact = TableRow<typeof creditNotePdfArtifacts>;
