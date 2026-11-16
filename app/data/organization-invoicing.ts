import type { Issue } from 'remix/data-schema';

import { canonicalCountry } from './client-billing.ts';
import { parseClientContacts } from './client-contacts.ts';
import { CLIENT_TEXT_LIMITS } from './client-text.ts';
import { db, organizationInvoicingProfiles } from './db.ts';
import type { Organization, OrganizationInvoicingProfile } from './db.ts';
import { parseOrganizationName } from './organization-name.ts';

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

/**
 * Validates the seller profile. The address may stay entirely blank, but once any address
 * field is filled in, line 1 and country are required. Contact channels reuse the Client
 * email/phone validation so the same input rules apply across the app.
 */
export function parseInvoicingProfile(input: InvoicingProfileInput): InvoicingProfileResult {
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
    },
  };
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

  return {
    legal_name: explicitLegalName,
    address_line1: addressLine1,
    address_locality: profile?.address_locality ?? null,
    address_region: profile?.address_region ?? null,
    address_postal_code: profile?.address_postal_code ?? null,
    address_country: addressCountry,
    billing_email: profile?.billing_email ?? null,
    billing_phone: profile?.billing_phone ?? null,
    legalName,
    explicitLegalName,
    issueReady: missingRequirements.length === 0,
    missingRequirements,
  };
}
