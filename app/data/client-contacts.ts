export const CLIENT_CONTACT_FIELDS = [
  'email',
  'phone',
  'contact_name',
  'contact_role',
  'contact_email',
  'contact_phone',
] as const;

export type ClientContactField = (typeof CLIENT_CONTACT_FIELDS)[number];

/** The contact columns a Client stores. All are optional; blanks are stored as `null`. */
export type ClientContactFields = {
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type ClientContactInput = Partial<Record<ClientContactField, string>>;

export interface ClientContactIssue {
  field: ClientContactField;
  message: string;
}

export type ClientContactResult =
  | { ok: true; value: ClientContactFields }
  | { ok: false; issues: ClientContactIssue[] };

/**
 * Basic shape checks only. Emails and international phone numbers are not verified,
 * and repeated values across Clients are allowed.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;

/**
 * Parses the optional contact fields shared by both Client types.
 *
 * The primary-contact group is business-only in the form, but its values are parsed for either
 * type so changing type never erases what was entered while the group was hidden.
 * If any primary-contact field is present, the contact name is required.
 */
export function parseClientContacts(input: ClientContactInput): ClientContactResult {
  let issues: ClientContactIssue[] = [];

  let email = clean(input.email);
  let phone = clean(input.phone);
  let contactName = clean(input.contact_name);
  let contactRole = clean(input.contact_role);
  let contactEmail = clean(input.contact_email);
  let contactPhone = clean(input.contact_phone);

  if (email && !isEmailShape(email)) {
    issues.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (phone && !isPhoneShape(phone)) {
    issues.push({
      field: 'phone',
      message: 'Enter a valid international phone number using digits, spaces, +, -, or parentheses.',
    });
  }
  if (contactEmail && !isEmailShape(contactEmail)) {
    issues.push({
      field: 'contact_email',
      message: 'Enter a valid primary contact email address.',
    });
  }
  if (contactPhone && !isPhoneShape(contactPhone)) {
    issues.push({
      field: 'contact_phone',
      message:
        'Enter a valid primary contact phone number using digits, spaces, +, -, or parentheses.',
    });
  }

  let hasPrimaryContact = Boolean(contactName || contactRole || contactEmail || contactPhone);
  if (hasPrimaryContact && !contactName) {
    issues.push({ field: 'contact_name', message: 'Enter the primary contact name.' });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      email: email || null,
      phone: phone || null,
      contact_name: contactName || null,
      contact_role: contactRole || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
    },
  };
}

/** True when the Client has at least one recorded contact detail. */
export function hasClientContacts(client: ClientContactFields): boolean {
  return CLIENT_CONTACT_FIELDS.some((field) => Boolean(client[field]));
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isEmailShape(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

function isPhoneShape(value: string): boolean {
  return PHONE_PATTERN.test(value) && /\d/.test(value);
}
