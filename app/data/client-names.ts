export type ClientType = 'individual' | 'business';

export const CLIENT_TYPES: readonly ClientType[] = ['individual', 'business'];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: 'Individual',
  business: 'Business',
};

/** Longest legal, preferred, or trading name the form accepts. */
export const CLIENT_NAME_MAX_LENGTH = 120;

export interface ClientNameFields {
  type: ClientType;
  legal_name: string;
  preferred_name: string | null;
  trading_name: string | null;
}

export interface ClientNameInput {
  type: string;
  legal_name: string;
  preferred_name?: string;
  trading_name?: string;
}

export type ClientNameField = 'type' | 'legal_name' | 'preferred_name' | 'trading_name';

export interface ClientNameIssue {
  field: ClientNameField;
  message: string;
}

export type ClientNameResult =
  | { ok: true; value: ClientNameFields }
  | { ok: false; issues: ClientNameIssue[] };

export function isClientType(value: unknown): value is ClientType {
  return value === 'individual' || value === 'business';
}

export function clientTypeLabel(type: ClientType): string {
  return CLIENT_TYPE_LABELS[type];
}

/**
 * Parses the type and name fields every Client shares.
 * Blank optional names are stored as `null`; type-specific values are kept even when the
 * other type is selected so a later type change can restore them.
 */
export function parseClientNames(input: ClientNameInput): ClientNameResult {
  let issues: ClientNameIssue[] = [];

  let type = isClientType(input.type) ? input.type : null;
  if (type === null) {
    issues.push({ field: 'type', message: 'Choose Individual or Business.' });
  }

  let legalName = input.legal_name.trim();
  if (!legalName) {
    issues.push({ field: 'legal_name', message: 'Enter the legal name.' });
  } else if (legalName.length > CLIENT_NAME_MAX_LENGTH) {
    issues.push({
      field: 'legal_name',
      message: `Legal name must be ${CLIENT_NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  let preferredName = parseOptionalName(input.preferred_name, 'preferred_name', issues);
  let tradingName = parseOptionalName(input.trading_name, 'trading_name', issues);

  if (type === null || issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      type,
      legal_name: legalName,
      preferred_name: preferredName,
      trading_name: tradingName,
    },
  };
}

/**
 * The familiar label for a Client: the type's optional name when set, otherwise the legal name.
 */
export function clientDisplayLabel(client: {
  type: ClientType;
  legal_name: string;
  preferred_name: string | null;
  trading_name: string | null;
}): string {
  let familiarName =
    client.type === 'individual' ? client.preferred_name : client.trading_name;
  return familiarName?.trim() || client.legal_name;
}

function parseOptionalName(
  input: string | undefined,
  field: 'preferred_name' | 'trading_name',
  issues: ClientNameIssue[],
): string | null {
  let value = input?.trim() ?? '';
  if (value.length > CLIENT_NAME_MAX_LENGTH) {
    issues.push({
      field,
      message: `Name must be ${CLIENT_NAME_MAX_LENGTH} characters or fewer.`,
    });
    return null;
  }
  return value || null;
}
