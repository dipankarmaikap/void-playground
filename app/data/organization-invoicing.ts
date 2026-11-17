import type { Issue } from 'remix/data-schema';

import { canonicalCountry } from './client-billing.ts';
import { parseClientContacts } from './client-contacts.ts';
import { GSTIN_PATTERN } from './client-tax.ts';
import { CLIENT_TEXT_LIMITS } from './client-text.ts';
import { db, organizationInvoicingProfiles } from './db.ts';
import type { Organization, OrganizationInvoicingProfile } from './db.ts';
import { ISO_4217_CURRENCY_MESSAGE, isIso4217Currency } from './currency.ts';
import { findIndiaStateByCode } from './india-states.ts';
import { parseOrganizationName } from './organization-name.ts';

/** The currency new invoices start with when the Client has no default of their own. */
export const DEFAULT_CURRENCY = 'INR';

/** The payment terms an Organization can offer on its invoices. */
export const PAYMENT_TERMS = [
  'due_on_receipt',
  'net_7',
  'net_15',
  'net_30',
  'net_60',
  'custom',
] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export const DEFAULT_PAYMENT_TERM: PaymentTerm = 'due_on_receipt';
export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  due_on_receipt: 'Due on receipt',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_60: 'Net 60',
  custom: 'Custom',
};

export const DEFAULT_INVOICE_PREFIX = 'INV';
export const DEFAULT_CREDIT_NOTE_PREFIX = 'CN';
export const DEFAULT_STARTING_NUMBER = 1;

/** The seller profile fields an Organization can save. All are optional strings from a form. */
export interface InvoicingProfileInput {
  legal_name?: string;
  address_line1?: string;
  address_locality?: string;
  address_region?: string;
  address_postal_code?: string;
  address_country?: string;
  billing_email?: string;
  billing_phone?: string;
  pan?: string;
  /** The form posts `on` for a checked registration checkbox and omits it when unchecked. */
  gst_registered?: string;
  gstin?: string;
  gst_state_code?: string;
  default_currency?: string;
  payment_term?: string;
  custom_payment_terms?: string;
  payment_instructions?: string;
  customer_notes?: string;
  invoice_prefix?: string;
  invoice_starting_number?: string;
  credit_note_prefix?: string;
  credit_note_starting_number?: string;
  logo?: string;
  remove_logo?: string;
  signature_image?: string;
  remove_signature_image?: string;
  signatory_name?: string;
  signatory_designation?: string;
}

/** Normalized values persisted for one Organization; blank optional fields become `null`. */
export interface InvoicingProfileValues {
  legal_name: string | null;
  address_line1: string | null;
  address_locality: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  pan: string | null;
  gst_registered: boolean;
  gstin: string | null;
  gst_state_code: string | null;
  gst_state_name: string | null;
  default_currency: string;
  payment_term: PaymentTerm;
  custom_payment_terms: string | null;
  payment_instructions: string | null;
  customer_notes: string | null;
  invoice_prefix: string;
  invoice_starting_number: number;
  credit_note_prefix: string;
  credit_note_starting_number: number;
  logo_data_url: string | null;
  signature_data_url: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
}

export type InvoicingProfileResult =
  | { ok: true; value: InvoicingProfileValues }
  | { ok: false; issues: Issue[] };

/** A read model that resolves defaults and issue-time readiness from the stored profile. */
export interface InvoicingProfileView extends InvoicingProfileValues {
  /** Explicit legal name, or the Organization name when none has been saved. */
  legalName: string;
  explicitLegalName: string | null;
  issueReady: boolean;
  missingRequirements: string[];
}

/** Standard 10-character Indian PAN shape; format only, no external registry is consulted. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Bound free text with the same limits the Client address and legal-name fields use.
const PROFILE_TEXT_LIMITS = {
  legal_name: { max: CLIENT_TEXT_LIMITS.legal_name, label: 'Legal seller name' },
  address_line1: { max: CLIENT_TEXT_LIMITS.billing_line1, label: 'Business address line 1' },
  address_locality: { max: CLIENT_TEXT_LIMITS.billing_locality, label: 'Locality or city' },
  address_region: { max: CLIENT_TEXT_LIMITS.billing_region, label: 'State or region' },
  address_postal_code: { max: CLIENT_TEXT_LIMITS.billing_postal_code, label: 'Postal code' },
  address_country: { max: CLIENT_TEXT_LIMITS.billing_country, label: 'Business country' },
} as const;

type ProfileTextField = keyof typeof PROFILE_TEXT_LIMITS;

/** Bounds for the client-visible defaults and custom terms saved for an Organization. */
const INVOICE_TEXT_LIMITS = {
  custom_payment_terms: { max: 200, label: 'Custom payment terms' },
  payment_instructions: { max: 1000, label: 'Payment instructions' },
  customer_notes: { max: 1000, label: 'Customer notes' },
} as const;

type InvoiceTextField = keyof typeof INVOICE_TEXT_LIMITS;

/** Short, unambiguous document prefixes. Lowercase input is normalized to uppercase. */
const PREFIX_MAX_LENGTH = 12;
const PREFIX_PATTERN = /^[A-Z0-9_-]+$/;
const STARTING_NUMBER_PATTERN = /^\d+$/;

/** Branding images are small, inline data URLs so they can be embedded directly into PDFs. */
export const IMAGE_MAX_BYTES = 128 * 1024;
const IMAGE_DATA_URL_PATTERN =
  /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const IMAGE_MAX_DATA_URL_CHARS = Math.ceil(IMAGE_MAX_BYTES / 3) * 4 + 64;

type ExistingImages = Pick<InvoicingProfileValues, 'logo_data_url' | 'signature_data_url'>;

/**
 * Validates the seller profile and invoicing defaults. The address may stay entirely blank, but
 * once any address field is filled in, line 1 and country are required. Contact channels reuse
 * the Client email/phone validation so the same input rules apply across the app. Image fields
 * resolve against the currently stored images so unrelated edits never drop an uploaded image.
 */
export function parseInvoicingProfile(
  input: InvoicingProfileInput,
  current?: ExistingImages,
): InvoicingProfileResult {
  let raw: Record<ProfileTextField, string> = {
    legal_name: input.legal_name ?? '',
    address_line1: input.address_line1 ?? '',
    address_locality: input.address_locality ?? '',
    address_region: input.address_region ?? '',
    address_postal_code: input.address_postal_code ?? '',
    address_country: input.address_country ?? '',
  };

  let issues: Issue[] = [];
  for (let field of Object.keys(PROFILE_TEXT_LIMITS) as ProfileTextField[]) {
    let value = raw[field];
    let { max, label } = PROFILE_TEXT_LIMITS[field];
    if (value.length > max) {
      issues.push({ message: `${label} must be ${max} characters or fewer.`, path: [field] });
    }
  }
  let legalNameInput = raw.legal_name.trim();
  let legalName: string | null = null;
  if (legalNameInput) {
    let parsed = parseOrganizationName(legalNameInput);
    if (!parsed.ok) {
      issues.push({ message: 'Legal seller name is required.', path: ['legal_name'] });
    } else {
      legalName = parsed.value;
    }
  }

  let addressLine1 = raw.address_line1.trim();
  let locality = raw.address_locality.trim();
  let region = raw.address_region.trim();
  let postalCode = raw.address_postal_code.trim();
  let countryInput = raw.address_country.trim();
  let hasAddress = Boolean(addressLine1 || locality || region || postalCode || countryInput);

  if (hasAddress) {
    if (!addressLine1) {
      issues.push({ message: 'Enter business address line 1.', path: ['address_line1'] });
    }
    if (!countryInput) {
      issues.push({ message: 'Enter a business country.', path: ['address_country'] });
    }
  }

  let contacts = parseClientContacts({
    email: input.billing_email ?? '',
    phone: input.billing_phone ?? '',
  });
  if (!contacts.ok) {
    for (let issue of contacts.issues) {
      issues.push({
        message: issue.message,
        path: [issue.field === 'email' ? 'billing_email' : 'billing_phone'],
      });
    }
  }

  let panInput = (input.pan ?? '').trim().toUpperCase();
  let pan: string | null = null;
  if (panInput) {
    if (!PAN_PATTERN.test(panInput)) {
      issues.push({
        message: 'Enter a valid 10-character PAN, for example AAPCS2319F.',
        path: ['pan'],
      });
    } else {
      pan = panInput;
    }
  }

  let gstRegistered = Boolean(
    input.gst_registered && ['on', 'true', '1', 'yes'].includes(input.gst_registered.trim().toLowerCase()),
  );
  let gstinInput = (input.gstin ?? '').trim().toUpperCase();
  let gstStateCode = (input.gst_state_code ?? '').trim();
  let gstin: string | null = null;
  let gstStateName: string | null = null;

  if (gstRegistered) {
    let state = findIndiaStateByCode(gstStateCode);
    if (!state) {
      issues.push({
        message: 'Choose the State or UT for GST registration.',
        path: ['gst_state_code'],
      });
    }

    if (!gstinInput) {
      issues.push({
        message: 'Enter a 15-character GSTIN, for example 27AAPCS2319F1Z5.',
        path: ['gstin'],
      });
    } else if (!GSTIN_PATTERN.test(gstinInput)) {
      issues.push({
        message: 'Enter a 15-character GSTIN, for example 27AAPCS2319F1Z5.',
        path: ['gstin'],
      });
    } else {
      if (state && gstinInput.slice(0, 2) !== state.code) {
        issues.push({
          message: 'State or UT code must match the first two digits of the GSTIN.',
          path: ['gst_state_code'],
        });
      }
      if (pan && gstinInput.slice(2, 12) !== pan) {
        issues.push({
          message: 'GSTIN characters 3 to 12 must match the PAN.',
          path: ['gstin'],
        });
      }
      gstin = gstinInput;
      gstStateName = state?.name ?? null;
    }
  }

  let currencyInput = (input.default_currency ?? '').trim().toUpperCase();
  let defaultCurrency = DEFAULT_CURRENCY;
  if (!isIso4217Currency(currencyInput)) {
    issues.push({ message: ISO_4217_CURRENCY_MESSAGE, path: ['default_currency'] });
  } else {
    defaultCurrency = currencyInput;
  }

  let paymentTermInput = (input.payment_term ?? '').trim();
  let paymentTerm: PaymentTerm = DEFAULT_PAYMENT_TERM;
  if (!(PAYMENT_TERMS as readonly string[]).includes(paymentTermInput)) {
    issues.push({ message: 'Choose a valid default payment term.', path: ['payment_term'] });
  } else {
    paymentTerm = paymentTermInput as PaymentTerm;
  }

  let invoiceText: Record<InvoiceTextField, string> = {
    custom_payment_terms: input.custom_payment_terms ?? '',
    payment_instructions: input.payment_instructions ?? '',
    customer_notes: input.customer_notes ?? '',
  };
  for (let field of Object.keys(INVOICE_TEXT_LIMITS) as InvoiceTextField[]) {
    let value = invoiceText[field];
    let { max, label } = INVOICE_TEXT_LIMITS[field];
    if (value.length > max) {
      issues.push({ message: `${label} must be ${max} characters or fewer.`, path: [field] });
    }
  }

  let invoicePrefix = parsePrefix(input.invoice_prefix ?? '', 'invoice', issues);
  let creditNotePrefix = parsePrefix(input.credit_note_prefix ?? '', 'credit-note', issues);
  if (invoicePrefix && creditNotePrefix && invoicePrefix === creditNotePrefix) {
    issues.push({
      message: 'Invoice and credit-note prefixes must be different.',
      path: ['credit_note_prefix'],
    });
  }
  let invoiceStartingNumber = parseStartingNumber(
    input.invoice_starting_number ?? '',
    'Invoice',
    issues,
  );
  let creditNoteStartingNumber = parseStartingNumber(
    input.credit_note_starting_number ?? '',
    'Credit-note',
    issues,
  );

  let logoDataUrl = resolveImage(
    input.logo ?? '',
    input.remove_logo ?? '',
    current?.logo_data_url ?? null,
    'Logo',
    issues,
  );
  let signatureDataUrl = resolveImage(
    input.signature_image ?? '',
    input.remove_signature_image ?? '',
    current?.signature_data_url ?? null,
    'Signature',
    issues,
  );
  let signatoryName = cleanOptional(input.signatory_name ?? '');
  let signatoryDesignation = cleanOptional(input.signatory_designation ?? '');
  if (signatoryName && signatoryName.length > 120) {
    issues.push({
      message: 'Signatory name must be 120 characters or fewer.',
      path: ['signatory_name'],
    });
  }
  if (signatoryDesignation && signatoryDesignation.length > 100) {
    issues.push({
      message: 'Signatory designation must be 100 characters or fewer.',
      path: ['signatory_designation'],
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      legal_name: legalName,
      address_line1: hasAddress ? addressLine1 || null : null,
      address_locality: hasAddress ? locality || null : null,
      address_region: hasAddress ? region || null : null,
      address_postal_code: hasAddress ? postalCode || null : null,
      address_country: hasAddress ? canonicalCountry(countryInput) : null,
      billing_email: contacts.ok ? contacts.value.email : null,
      billing_phone: contacts.ok ? contacts.value.phone : null,
      pan,
      gst_registered: gstRegistered,
      gstin: gstRegistered ? gstin : null,
      gst_state_code: gstRegistered && gstin ? gstStateCode : null,
      gst_state_name: gstRegistered && gstin ? gstStateName : null,
      default_currency: defaultCurrency,
      payment_term: paymentTerm,
      custom_payment_terms:
        paymentTerm === 'custom' ? cleanOptional(invoiceText.custom_payment_terms) : null,
      payment_instructions: cleanOptional(invoiceText.payment_instructions),
      customer_notes: cleanOptional(invoiceText.customer_notes),
      invoice_prefix: invoicePrefix ?? DEFAULT_INVOICE_PREFIX,
      invoice_starting_number: invoiceStartingNumber ?? DEFAULT_STARTING_NUMBER,
      credit_note_prefix: creditNotePrefix ?? DEFAULT_CREDIT_NOTE_PREFIX,
      credit_note_starting_number: creditNoteStartingNumber ?? DEFAULT_STARTING_NUMBER,
      logo_data_url: logoDataUrl,
      signature_data_url: signatureDataUrl,
      signatory_name: signatoryName,
      signatory_designation: signatoryDesignation,
    },
  };
}

function cleanOptional(value: string): string | null {
  return value.trim() || null;
}

function parsePrefix(raw: string, kind: 'invoice' | 'credit-note', issues: Issue[]): string | null {
  let field = kind === 'invoice' ? 'invoice_prefix' : 'credit_note_prefix';
  let label = kind === 'invoice' ? 'an invoice' : 'a credit-note';
  let value = raw.trim().toUpperCase();
  if (!value) {
    issues.push({ message: `Enter ${label} number prefix.`, path: [field] });
    return null;
  }
  if (value.length > PREFIX_MAX_LENGTH) {
    issues.push({
      message: `Prefixes must be ${PREFIX_MAX_LENGTH} characters or fewer.`,
      path: [field],
    });
  }
  if (!PREFIX_PATTERN.test(value)) {
    issues.push({
      message: 'Prefixes may contain only letters, digits, hyphens, and underscores.',
      path: [field],
    });
  }
  return value;
}

function asPaymentTerm(value: string | null | undefined): PaymentTerm {
  return value && (PAYMENT_TERMS as readonly string[]).includes(value)
    ? (value as PaymentTerm)
    : DEFAULT_PAYMENT_TERM;
}

function isChecked(value: string): boolean {
  return ['on', 'true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/**
 * Resolves one optional image. A blank text field keeps the stored image (or clears it when its
 * remove checkbox is checked), while a new data URL replaces it after MIME and byte-size checks.
 */
function resolveImage(
  raw: string,
  remove: string,
  current: string | null,
  label: 'Logo' | 'Signature',
  issues: Issue[],
): string | null {
  let field = label === 'Logo' ? 'logo' : 'signature_image';
  let text = raw.trim();
  if (!text) return isChecked(remove) ? null : current;

  let sizeMessage = `${label} image must be 128 KB or smaller.`;
  let formatMessage = `${label} must be a PNG, JPEG, or WebP image data URL.`;
  if (text.length > IMAGE_MAX_DATA_URL_CHARS) {
    issues.push({ message: sizeMessage, path: [field] });
    return current;
  }
  let match = IMAGE_DATA_URL_PATTERN.exec(text);
  if (!match) {
    issues.push({ message: formatMessage, path: [field] });
    return current;
  }
  let encoded = match[2]!;
  let bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength === 0 || bytes.toString('base64') !== encoded) {
    issues.push({ message: formatMessage, path: [field] });
    return current;
  }
  if (bytes.byteLength > IMAGE_MAX_BYTES) {
    issues.push({ message: sizeMessage, path: [field] });
    return current;
  }
  return text;
}

function parseStartingNumber(raw: string, label: string, issues: Issue[]): number | null {
  let field = label === 'Invoice' ? 'invoice_starting_number' : 'credit_note_starting_number';
  let message = `${label} starting sequence must be a positive whole number.`;
  let value = raw.trim();
  if (!STARTING_NUMBER_PATTERN.test(value)) {
    issues.push({ message, path: [field] });
    return null;
  }
  let parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    issues.push({ message, path: [field] });
    return null;
  }
  return parsed;
}

/** Reads the one profile row owned by an Organization, or null when it has never saved one. */
export function findInvoicingProfile(
  organizationId: string,
): Promise<OrganizationInvoicingProfile | null> {
  return db.find(organizationInvoicingProfiles, organizationId);
}

/** Creates or updates the profile for one Organization. The Organization id always comes from the server. */
export async function saveInvoicingProfile(
  organizationId: string,
  values: InvoicingProfileValues,
): Promise<OrganizationInvoicingProfile | null> {
  let now = Date.now();
  let existing = await findInvoicingProfile(organizationId);
  if (existing) {
    await db.update(organizationInvoicingProfiles, organizationId, {
      ...values,
      updated_at: now,
    });
  } else {
    await db.create(organizationInvoicingProfiles, {
      organization_id: organizationId,
      ...values,
      created_at: now,
      updated_at: now,
    });
  }
  return findInvoicingProfile(organizationId);
}

/** Resolves stored values, the default legal seller name, and issue-time readiness. */
export async function getInvoicingProfileView(
  organization: Organization,
): Promise<InvoicingProfileView> {
  let profile = await findInvoicingProfile(organization.id);
  let explicitLegalName = profile?.legal_name ?? null;
  let legalName = explicitLegalName?.trim() || organization.name;
  let addressLine1 = profile?.address_line1 ?? null;
  let addressCountry = profile?.address_country ?? null;

  let missingRequirements: string[] = [];
  if (!legalName.trim()) missingRequirements.push('Seller legal name');
  if (!addressLine1?.trim()) missingRequirements.push('Business address line 1');
  if (!addressCountry?.trim()) missingRequirements.push('Business country');
  if (profile?.gst_registered) {
    if (!profile.gstin?.trim() || !GSTIN_PATTERN.test(profile.gstin)) {
      missingRequirements.push('GSTIN');
    }
    if (!profile.gst_state_code?.trim() || !findIndiaStateByCode(profile.gst_state_code)) {
      missingRequirements.push('GST State/UT');
    }
  }

  return {
    legal_name: explicitLegalName,
    address_line1: addressLine1,
    address_locality: profile?.address_locality ?? null,
    address_region: profile?.address_region ?? null,
    address_postal_code: profile?.address_postal_code ?? null,
    address_country: addressCountry,
    billing_email: profile?.billing_email ?? null,
    billing_phone: profile?.billing_phone ?? null,
    pan: profile?.pan ?? null,
    gst_registered: profile?.gst_registered ?? false,
    gstin: profile?.gstin ?? null,
    gst_state_code: profile?.gst_state_code ?? null,
    gst_state_name: profile?.gst_state_name ?? null,
    default_currency: profile?.default_currency ?? DEFAULT_CURRENCY,
    payment_term: asPaymentTerm(profile?.payment_term),
    custom_payment_terms: profile?.custom_payment_terms ?? null,
    payment_instructions: profile?.payment_instructions ?? null,
    customer_notes: profile?.customer_notes ?? null,
    invoice_prefix: profile?.invoice_prefix ?? DEFAULT_INVOICE_PREFIX,
    invoice_starting_number: profile?.invoice_starting_number ?? DEFAULT_STARTING_NUMBER,
    credit_note_prefix: profile?.credit_note_prefix ?? DEFAULT_CREDIT_NOTE_PREFIX,
    credit_note_starting_number: profile?.credit_note_starting_number ?? DEFAULT_STARTING_NUMBER,
    logo_data_url: profile?.logo_data_url ?? null,
    signature_data_url: profile?.signature_data_url ?? null,
    signatory_name: profile?.signatory_name ?? null,
    signatory_designation: profile?.signatory_designation ?? null,
    legalName,
    explicitLegalName,
    issueReady: missingRequirements.length === 0,
    missingRequirements,
  };
}
