import { belongsTo, hasMany, hasOne } from 'remix/data-table';

import {
  clients,
  creditNoteLines,
  creditNotePdfArtifacts,
  creditNotes,
  documentSequences,
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
  users,
} from './tables.ts';

/**
 * Query-descriptor relations over the typed tables, named `<children> for <parent>` for
 * has-many/has-one sides and `<parent> for <child>` for belongs-to sides. The SQL foreign
 * keys in the migrations remain the enforcement; these descriptors only load related rows
 * through the data-table API's `with: { ... }` option.
 */

// The Organization owns every row scoped to it.
export const membershipsForOrganization = hasMany(organizations, organizationMemberships, {
  foreignKey: 'organization_id',
});
export const clientsForOrganization = hasMany(organizations, clients, {
  foreignKey: 'organization_id',
});
export const invoicesForOrganization = hasMany(organizations, invoices, {
  foreignKey: 'organization_id',
});
export const documentSequencesForOrganization = hasMany(organizations, documentSequences, {
  foreignKey: 'organization_id',
});
export const gstPresetsForOrganization = hasMany(organizations, organizationGstRatePresets, {
  foreignKey: 'organization_id',
});
export const invoicingProfileForOrganization = hasOne(organizations, organizationInvoicingProfiles, {
  foreignKey: 'organization_id',
});

// A User reaches their Organizations and authenticated Sessions through memberships.
export const membershipsForUser = hasMany(users, organizationMemberships, {
  foreignKey: 'user_id',
});
export const sessionsForUser = hasMany(users, sessions, { foreignKey: 'user_id' });
export const organizationForMembership = belongsTo(organizationMemberships, organizations, {
  foreignKey: 'organization_id',
});
export const userForMembership = belongsTo(organizationMemberships, users, {
  foreignKey: 'user_id',
});
export const userForSession = belongsTo(sessions, users, { foreignKey: 'user_id' });

// A Client belongs to one Organization and owns its invoice history.
export const organizationForClient = belongsTo(clients, organizations, {
  foreignKey: 'organization_id',
});
export const invoicesForClient = hasMany(clients, invoices, { foreignKey: 'client_id' });

// An Invoice snapshot belongs to its Organization and Client, and owns its activity rows.
export const organizationForInvoice = belongsTo(invoices, organizations, {
  foreignKey: 'organization_id',
});
export const clientForInvoice = belongsTo(invoices, clients, { foreignKey: 'client_id' });
export const invoiceLinesByPosition = hasMany(invoices, invoiceLines, {
  foreignKey: 'invoice_id',
}).orderBy('position', 'asc');
export const paymentsForInvoice = hasMany(invoices, invoicePayments, {
  foreignKey: 'invoice_id',
});
export const refundsForInvoice = hasMany(invoices, invoiceRefunds, {
  foreignKey: 'invoice_id',
});
export const creditNotesForInvoice = hasMany(invoices, creditNotes, {
  foreignKey: 'invoice_id',
});
export const pdfArtifactForInvoice = hasOne(invoices, invoicePdfArtifacts, {
  foreignKey: 'invoice_id',
});

// Invoice-owned rows point back to their invoice.
export const invoiceForLine = belongsTo(invoiceLines, invoices, { foreignKey: 'invoice_id' });
export const invoiceForPayment = belongsTo(invoicePayments, invoices, {
  foreignKey: 'invoice_id',
});
export const invoiceForRefund = belongsTo(invoiceRefunds, invoices, {
  foreignKey: 'invoice_id',
});

// A Credit Note links back to its invoice and owns its credited lines and issued PDF.
export const invoiceForCreditNote = belongsTo(creditNotes, invoices, {
  foreignKey: 'invoice_id',
});
export const creditNoteLinesByPosition = hasMany(creditNotes, creditNoteLines, {
  foreignKey: 'credit_note_id',
}).orderBy('position', 'asc');
export const pdfArtifactForCreditNote = hasOne(creditNotes, creditNotePdfArtifacts, {
  foreignKey: 'credit_note_id',
});
export const creditNoteForLine = belongsTo(creditNoteLines, creditNotes, {
  foreignKey: 'credit_note_id',
});
export const invoiceForCreditNoteLine = belongsTo(creditNoteLines, invoices, {
  foreignKey: 'invoice_id',
});
export const invoiceLineForCreditNoteLine = belongsTo(creditNoteLines, invoiceLines, {
  foreignKey: 'invoice_line_id',
});

// Organization-owned settings rows point back to their Organization.
export const organizationForPreset = belongsTo(organizationGstRatePresets, organizations, {
  foreignKey: 'organization_id',
});
export const organizationForSequence = belongsTo(documentSequences, organizations, {
  foreignKey: 'organization_id',
});
export const organizationForProfile = belongsTo(organizationInvoicingProfiles, organizations, {
  foreignKey: 'organization_id',
});
