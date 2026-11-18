import { column as c, table } from 'remix/data-table';

import { CLIENT_TYPES } from '../client-names.ts';

export const users = table({
  name: 'users',
  columns: {
    id: c.text().notNull(),
    email: c.text().notNull(),
    display_name: c.text().nullable(),
    email_verified: c.boolean().notNull(),
    verification_token: c.text().nullable(),
    verification_expires_at: c.integer().nullable(),
    created_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    if ('email_verified' in value) {
      return { value: { ...value, email_verified: Boolean(value.email_verified) } };
    }
    return { value };
  },
});

export const organizations = table({
  name: 'organizations',
  columns: {
    id: c.text().notNull(),
    name: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/**
 * Organization-owned seller profile used by invoices. One row per Organization; the effective
 * legal seller name falls back to `organizations.name` when `legal_name` is null.
 */
export const organizationInvoicingProfiles = table({
  name: 'organization_invoicing_profiles',
  columns: {
    organization_id: c.text().notNull(),
    legal_name: c.text().nullable(),
    address_line1: c.text().nullable(),
    address_locality: c.text().nullable(),
    address_region: c.text().nullable(),
    address_postal_code: c.text().nullable(),
    address_country: c.text().nullable(),
    billing_email: c.text().nullable(),
    billing_phone: c.text().nullable(),
    pan: c.text().nullable(),
    gst_registered: c.boolean().notNull(),
    gstin: c.text().nullable(),
    gst_state_code: c.text().nullable(),
    gst_state_name: c.text().nullable(),
    default_currency: c.text().notNull(),
    payment_term: c.text().notNull(),
    custom_payment_terms: c.text().nullable(),
    payment_instructions: c.text().nullable(),
    customer_notes: c.text().nullable(),
    invoice_prefix: c.text().notNull(),
    invoice_starting_number: c.integer().notNull(),
    credit_note_prefix: c.text().notNull(),
    credit_note_starting_number: c.integer().notNull(),
    logo_data_url: c.text().nullable(),
    signature_data_url: c.text().nullable(),
    signatory_name: c.text().nullable(),
    signatory_designation: c.text().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'organization_id',
  afterRead({ value }) {
    if ('gst_registered' in value) {
      return { value: { ...value, gst_registered: Boolean(value.gst_registered) } };
    }
    return { value };
  },
});

/**
 * Organization-owned, editable Indian GST rate presets. Rates are stored as canonical decimal
 * strings so invoice calculations never inherit floating-point rounding from the database.
 */
export const organizationGstRatePresets = table({
  name: 'organization_gst_rate_presets',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    rate: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

export const organizationMemberships = table({
  name: 'organization_memberships',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    user_id: c.text().notNull(),
    is_owner: c.boolean().notNull(),
    created_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    if ('is_owner' in value) {
      return { value: { ...value, is_owner: Boolean(value.is_owner) } };
    }
    return { value };
  },
});

export const userPasswords = table({
  name: 'user_passwords',
  columns: {
    user_id: c.text().notNull(),
    password_hash: c.text().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'user_id',
});

export const sessions = table({
  name: 'sessions',
  columns: {
    id: c.text().notNull(),
    user_id: c.text().notNull(),
    data: c.text().notNull(),
    ip: c.text().nullable(),
    user_agent: c.text().nullable(),
    created_at: c.integer().notNull(),
    last_active_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

export const clients = table({
  name: 'clients',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    type: c.enum(CLIENT_TYPES).notNull(),
    legal_name: c.text().notNull(),
    preferred_name: c.text().nullable(),
    trading_name: c.text().nullable(),
    industry: c.text().nullable(),
    email: c.text().nullable(),
    phone: c.text().nullable(),
    contact_name: c.text().nullable(),
    contact_role: c.text().nullable(),
    contact_email: c.text().nullable(),
    contact_phone: c.text().nullable(),
    billing_line1: c.text().nullable(),
    billing_locality: c.text().nullable(),
    billing_region: c.text().nullable(),
    billing_postal_code: c.text().nullable(),
    billing_country: c.text().nullable(),
    billing_currency: c.text().nullable(),
    tax_country: c.text().nullable(),
    tax_type: c.text().nullable(),
    tax_value: c.text().nullable(),
    tax_state_name: c.text().nullable(),
    tax_state_code: c.text().nullable(),
    status: c.enum(['active', 'archived'] as const).notNull(),
    archived_at: c.integer().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/**
 * An Organization-scoped invoice. Drafts carry no `invoice_number`; issue-time numbering and seller
 * snapshots are stored alongside the recipient values already copied onto the invoice.
 */
export const invoices = table({
  name: 'invoices',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    client_id: c.text().notNull(),
    document_type: c.text().notNull(),
    status: c.text().notNull(),
    invoice_number: c.text().nullable(),
    issued_at: c.integer().nullable(),
    seller_legal_name: c.text().nullable(),
    seller_address_line1: c.text().nullable(),
    seller_address_locality: c.text().nullable(),
    seller_address_region: c.text().nullable(),
    seller_address_postal_code: c.text().nullable(),
    seller_country: c.text().nullable(),
    seller_email: c.text().nullable(),
    seller_phone: c.text().nullable(),
    seller_pan: c.text().nullable(),
    seller_gst_registered: c.boolean().notNull(),
    seller_gstin: c.text().nullable(),
    seller_gst_state_code: c.text().nullable(),
    seller_gst_state_name: c.text().nullable(),
    seller_logo_data_url: c.text().nullable(),
    seller_signature_data_url: c.text().nullable(),
    seller_signatory_name: c.text().nullable(),
    seller_signatory_designation: c.text().nullable(),
    currency: c.text().notNull(),
    invoice_date: c.text().notNull(),
    due_date: c.text().notNull(),
    payment_term: c.text().notNull(),
    custom_payment_terms: c.text().nullable(),
    recipient_legal_name: c.text().notNull(),
    recipient_billing_line1: c.text().nullable(),
    recipient_billing_locality: c.text().nullable(),
    recipient_billing_region: c.text().nullable(),
    recipient_billing_postal_code: c.text().nullable(),
    recipient_billing_country: c.text().nullable(),
    recipient_tax_country: c.text().nullable(),
    recipient_tax_type: c.text().nullable(),
    recipient_tax_value: c.text().nullable(),
    recipient_tax_state_name: c.text().nullable(),
    recipient_tax_state_code: c.text().nullable(),
    gst_mode: c.text().notNull(),
    supply_type: c.text().nullable(),
    place_of_supply_state_code: c.text().nullable(),
    place_of_supply_state_name: c.text().nullable(),
    place_of_supply_country: c.text().nullable(),
    recipient_gstin_applicable: c.boolean().notNull(),
    reverse_charge: c.boolean().notNull(),
    export_reference: c.text().nullable(),
    payment_instructions: c.text().nullable(),
    customer_notes: c.text().nullable(),
    internal_note: c.text().nullable(),
    subtotal_minor: c.integer().notNull(),
    line_discount_total_minor: c.integer().notNull(),
    invoice_discount_mode: c.text().nullable(),
    invoice_discount_value: c.text().nullable(),
    invoice_discount_minor: c.integer().notNull(),
    net_subtotal_minor: c.integer().notNull(),
    tax_total_minor: c.integer().notNull(),
    round_off_minor: c.integer().notNull(),
    total_minor: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
  afterRead({ value }) {
    let normalized = { ...value };
    if ('recipient_gstin_applicable' in normalized) {
      normalized.recipient_gstin_applicable = Boolean(normalized.recipient_gstin_applicable);
      normalized.reverse_charge = Boolean(normalized.reverse_charge);
    }
    if ('seller_gst_registered' in normalized) {
      normalized.seller_gst_registered = Boolean(normalized.seller_gst_registered);
    }
    return { value: normalized };
  },
});

/** The last issued sequence number for one Organization, document type, and financial year. */
export const documentSequences = table({
  name: 'document_sequences',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    document_type: c.text().notNull(),
    financial_year: c.text().notNull(),
    current_number: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/**
 * The immutable issued-PDF artifact stored for exactly one issued invoice. The composite foreign
 * key and the `(organization_id, invoice_id)` unique constraint keep every artifact bound to a
 * single invoice inside the same Organization.
 */
export const invoicePdfArtifacts = table({
  name: 'invoice_pdf_artifacts',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    data: c.binary().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** A confirmed offline payment belonging to one invoice in the same Organization. */
export const invoicePayments = table({
  name: 'invoice_payments',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    payment_date: c.text().notNull(),
    amount_minor: c.integer().notNull(),
    payment_method: c.text().notNull(),
    reference: c.text().nullable(),
    voided_at: c.integer().nullable(),
    void_reason: c.text().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** A manual refund belonging to one over-credited invoice in the same Organization. */
export const invoiceRefunds = table({
  name: 'invoice_refunds',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    refund_date: c.text().notNull(),
    amount_minor: c.integer().notNull(),
    refund_method: c.text().notNull(),
    reference: c.text().nullable(),
    voided_at: c.integer().nullable(),
    void_reason: c.text().nullable(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** A free-form service line belonging to one invoice in the same Organization. */
export const invoiceLines = table({
  name: 'invoice_lines',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    position: c.integer().notNull(),
    description: c.text().notNull(),
    sac: c.text().nullable(),
    quantity: c.text().notNull(),
    unit_price: c.text().notNull(),
    amount_minor: c.integer().notNull(),
    discount_mode: c.text().nullable(),
    discount_value: c.text().nullable(),
    line_discount_minor: c.integer().notNull(),
    allocated_invoice_discount_minor: c.integer().notNull(),
    net_minor: c.integer().notNull(),
    tax_treatment: c.text().nullable(),
    gst_rate: c.text().nullable(),
    cgst_rate: c.text().nullable(),
    sgst_rate: c.text().nullable(),
    igst_rate: c.text().nullable(),
    cgst_amount_minor: c.integer().notNull(),
    sgst_amount_minor: c.integer().notNull(),
    igst_amount_minor: c.integer().notNull(),
    foreign_tax_label: c.text().nullable(),
    foreign_tax_mode: c.text().nullable(),
    foreign_tax_rate: c.text().nullable(),
    foreign_tax_amount_minor: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** A Draft or immutable issued credit note linked to one issued invoice. */
export const creditNotes = table({
  name: 'credit_notes',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    status: c.text().notNull(),
    credit_note_number: c.text().nullable(),
    credit_date: c.text().notNull(),
    reason: c.text().notNull(),
    issued_at: c.integer().nullable(),
    subtotal_minor: c.integer().notNull(),
    line_discount_total_minor: c.integer().notNull(),
    invoice_discount_mode: c.text().nullable(),
    invoice_discount_minor: c.integer().notNull(),
    net_subtotal_minor: c.integer().notNull(),
    tax_total_minor: c.integer().notNull(),
    round_off_minor: c.integer().notNull(),
    total_minor: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** A credited service line, tied to both its Credit Note and original invoice line. */
export const creditNoteLines = table({
  name: 'credit_note_lines',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    credit_note_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    invoice_line_id: c.text().notNull(),
    position: c.integer().notNull(),
    description: c.text().notNull(),
    sac: c.text().nullable(),
    quantity: c.text().notNull(),
    unit_price: c.text().notNull(),
    amount_minor: c.integer().notNull(),
    discount_mode: c.text().nullable(),
    discount_value: c.text().nullable(),
    line_discount_minor: c.integer().notNull(),
    allocated_invoice_discount_minor: c.integer().notNull(),
    net_minor: c.integer().notNull(),
    tax_treatment: c.text().nullable(),
    gst_rate: c.text().nullable(),
    cgst_rate: c.text().nullable(),
    sgst_rate: c.text().nullable(),
    igst_rate: c.text().nullable(),
    cgst_amount_minor: c.integer().notNull(),
    sgst_amount_minor: c.integer().notNull(),
    igst_amount_minor: c.integer().notNull(),
    foreign_tax_label: c.text().nullable(),
    foreign_tax_mode: c.text().nullable(),
    foreign_tax_rate: c.text().nullable(),
    foreign_tax_amount_minor: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});

/** The exact PDF bytes captured when a Credit Note is issued. */
export const creditNotePdfArtifacts = table({
  name: 'credit_note_pdf_artifacts',
  columns: {
    id: c.text().notNull(),
    organization_id: c.text().notNull(),
    invoice_id: c.text().notNull(),
    credit_note_id: c.text().notNull(),
    data: c.binary().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  primaryKey: 'id',
});
