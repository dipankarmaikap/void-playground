import type { Database } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { findIndiaStateByCode } from '../india-states.ts';
import { invoiceLines, invoices, organizationInvoicingProfiles, organizations } from '../db.ts';
import type { Invoice, InvoiceLine } from '../db.ts';
import { GSTIN_PATTERN, isIndiaCountry, UIN_PATTERN } from '../client-tax.ts';
import type { InvoicePdfDocument } from './documents.ts';
import { allocateDocumentNumber } from './document-numbers.ts';
import { parseScaledDecimal } from './calculation.ts';
import { todayInKolkata } from './dates.ts';
import {
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_STARTING_NUMBER,
} from '../organization/invoicing.ts';

export type InvoiceDisplayStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

/** Derives an issued invoice's status from credits, net paid, and the Kolkata date. */
export function invoiceDisplayStatus(
  invoice: Pick<Invoice, 'status' | 'due_date' | 'total_minor'>,
  netPaidMinor = 0,
  today = todayInKolkata(),
  creditedTotalMinor = 0,
): InvoiceDisplayStatus {
  if (invoice.status === 'draft') return 'draft';
  let revisedTotalMinor = Math.max(0, invoice.total_minor - creditedTotalMinor);
  if (creditedTotalMinor > 0 && revisedTotalMinor === 0) return 'cancelled';
  let balanceDueMinor = Math.max(0, revisedTotalMinor - netPaidMinor);
  if (revisedTotalMinor > 0 && balanceDueMinor === 0) return 'paid';
  if (balanceDueMinor > 0 && today > invoice.due_date) return 'overdue';
  if (netPaidMinor > 0 && balanceDueMinor > 0) return 'partially_paid';
  return 'sent';
}

/** Indian financial years use April 1 as the first day; invoice_date is already a calendar date. */
export function indianFinancialYear(invoiceDate: string): string {
  let year = Number(invoiceDate.slice(0, 4));
  let month = Number(invoiceDate.slice(5, 7));
  let startYear = month >= 4 ? year : year - 1;
  return `${String(startYear % 100).padStart(2, '0')}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export interface IssuedInvoiceFinalizerContext {
  /** Runs inside the issue transaction; use it to persist the immutable issued PDF artifact. */
  transaction: Database;
  /** Client-facing snapshot excludes the private internal note by construction. */
  invoice: InvoicePdfDocument;
  lines: readonly InvoiceLine[];
}

export type IssuedInvoiceFinalizer = (
  context: IssuedInvoiceFinalizerContext,
) => Promise<void>;

export type IssueDraftInvoiceResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'conflict' }
  | { ok: false; kind: 'invalid'; errors: string[] };

class IssueConflict extends Error {}

function isValidServiceLine(line: InvoiceLine): boolean {
  let quantity = parseScaledDecimal(line.quantity);
  let unitPrice = parseScaledDecimal(line.unit_price);
  return (
    Boolean(line.description.trim()) &&
    quantity != null &&
    quantity > 0n &&
    unitPrice != null &&
    line.amount_minor >= 0 &&
    line.line_discount_minor >= 0 &&
    line.allocated_invoice_discount_minor >= 0 &&
    line.net_minor >= 0
  );
}

function issueValidationErrors(
  invoice: Invoice,
  lines: readonly InvoiceLine[],
  seller: {
    addressLine1: string | null;
    country: string | null;
    gstRegistered: boolean;
    gstin: string | null;
    gstStateCode: string | null;
  },
): string[] {
  let errors: string[] = [];
  if (!seller.addressLine1?.trim()) {
    errors.push('Set business address line 1 in Invoicing settings before issuing this invoice.');
  }
  if (!seller.country?.trim()) {
    errors.push('Set the business country in Invoicing settings before issuing this invoice.');
  }
  if (seller.gstRegistered) {
    let state = findIndiaStateByCode(seller.gstStateCode ?? '');
    if (!seller.gstin || !GSTIN_PATTERN.test(seller.gstin)) {
      errors.push('Set a valid seller GSTIN in Invoicing settings before issuing this invoice.');
    }
    if (!state || (seller.gstin && seller.gstin.slice(0, 2) !== state.code)) {
      errors.push('Set a valid GST State/UT in Invoicing settings before issuing this invoice.');
    }
  }

  if (!invoice.recipient_legal_name.trim()) {
    errors.push('Enter the recipient legal name before issuing this invoice.');
  }
  if (!invoice.recipient_billing_line1?.trim()) {
    errors.push('Enter the recipient billing address line 1 before issuing this invoice.');
  }
  if (!invoice.recipient_billing_country?.trim()) {
    errors.push('Enter the recipient billing country before issuing this invoice.');
  }
  if (invoice.recipient_gstin_applicable) {
    let taxValue = (invoice.recipient_tax_value ?? '').trim().toUpperCase();
    let validTaxValue =
      (invoice.recipient_tax_type === 'gstin' && GSTIN_PATTERN.test(taxValue)) ||
      (invoice.recipient_tax_type === 'uin' && UIN_PATTERN.test(taxValue));
    if (!isIndiaCountry(invoice.recipient_tax_country ?? '') || !validTaxValue) {
      errors.push('Enter a valid recipient GSTIN or UIN because it is marked applicable.');
    }
  }
  if (invoiceLinesInvalid(lines)) {
    errors.push('Add at least one valid service line and correct any incomplete service lines.');
  }
  return errors;
}

function invoiceLinesInvalid(lines: readonly InvoiceLine[]): boolean {
  return lines.length === 0 || lines.some((line) => !isValidServiceLine(line));
}

/**
 * Issues a Draft atomically: validates current settings and invoice lines, allocates its FY number,
 * stores seller snapshots, then invokes the optional artifact finalizer before the transaction commits.
 */
export async function issueDraftInvoice(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  finalizeIssuedInvoice?: IssuedInvoiceFinalizer,
): Promise<IssueDraftInvoiceResult> {
  try {
    return await db.transaction(async (transaction) => {
      let invoice = await transaction.findOne(invoices, {
        where: { id: invoiceId, organization_id: organizationId },
      });
      if (!invoice) return { ok: false, kind: 'not_found' } as const;
      if (invoice.status !== 'draft') return { ok: false, kind: 'conflict' } as const;

      let organization = await transaction.find(organizations, organizationId);
      if (!organization) return { ok: false, kind: 'not_found' } as const;
      let profile = await transaction.find(organizationInvoicingProfiles, organizationId);
      let lines = await transaction.findMany(invoiceLines, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
        orderBy: [['position', 'asc']],
      });

      // Spec #30: the seller legal name defaults to the Organization name until it is overridden in
      // Invoicing settings, so it is never blank here and needs no issue-time validation branch.
      let legalName = profile?.legal_name?.trim() || organization.name.trim();
      let state = findIndiaStateByCode(profile?.gst_state_code ?? '');
      let seller = {
        addressLine1: profile?.address_line1 ?? null,
        country: profile?.address_country ?? null,
        gstRegistered: profile?.gst_registered ?? false,
        gstin: profile?.gstin ?? null,
        gstStateCode: profile?.gst_state_code ?? null,
      };
      let errors = issueValidationErrors(invoice, lines, seller);
      if (errors.length > 0) return { ok: false, kind: 'invalid', errors } as const;

      let now = Date.now();
      let financialYear = indianFinancialYear(invoice.invoice_date);
      let invoiceNumber = await allocateDocumentNumber(
        transaction,
        organizationId,
        financialYear,
        {
          documentType: 'invoice',
          prefix: profile?.invoice_prefix ?? DEFAULT_INVOICE_PREFIX,
          startingNumber: profile?.invoice_starting_number ?? DEFAULT_STARTING_NUMBER,
        },
        now,
      );
      let update = await transaction.updateMany(
        invoices,
        {
          status: 'issued',
          invoice_number: invoiceNumber,
          issued_at: now,
          seller_legal_name: legalName,
          seller_address_line1: profile?.address_line1 ?? null,
          seller_address_locality: profile?.address_locality ?? null,
          seller_address_region: profile?.address_region ?? null,
          seller_address_postal_code: profile?.address_postal_code ?? null,
          seller_country: profile?.address_country ?? null,
          seller_email: profile?.billing_email ?? null,
          seller_phone: profile?.billing_phone ?? null,
          seller_pan: profile?.pan ?? null,
          seller_gst_registered: profile?.gst_registered ?? false,
          seller_gstin: profile?.gstin ?? null,
          seller_gst_state_code: profile?.gst_state_code ?? null,
          seller_gst_state_name: profile?.gst_state_name ?? state?.name ?? null,
          seller_logo_data_url: profile?.logo_data_url ?? null,
          seller_signature_data_url: profile?.signature_data_url ?? null,
          seller_signatory_name: profile?.signatory_name ?? null,
          seller_signatory_designation: profile?.signatory_designation ?? null,
          updated_at: now,
        },
        { where: { id: invoiceId, organization_id: organizationId, status: 'draft' }, limit: 1 },
      );
      if (update.affectedRows === 0) throw new IssueConflict();

      let issuedInvoice = await transaction.find(invoices, invoiceId);
      if (!issuedInvoice) throw new Error('Issued invoice could not be reloaded.');

      // PDF generation and persistence belong here so the artifact commits with issuance (#48).
      let { internal_note: _privateNote, ...clientFacingInvoice } = issuedInvoice;
      await finalizeIssuedInvoice?.({
        transaction,
        invoice: clientFacingInvoice,
        lines,
      });
      return { ok: true, invoice: issuedInvoice } as const;
    });
  } catch (error) {
    if (error instanceof IssueConflict) return { ok: false, kind: 'conflict' };
    throw error;
  }
}
