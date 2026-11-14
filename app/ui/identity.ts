export interface IdentityInput {
  email: string;
  displayName?: string | null;
}

export interface Identity {
  /** The display name when one is set, otherwise the email address. */
  name: string;
  /** The email address, shown beneath the name only when a display name is set. */
  email: string | null;
}

export function identityOf(input: IdentityInput): Identity {
  let displayName = input.displayName?.trim() || null;
  return displayName ? { name: displayName, email: input.email } : { name: input.email, email: null };
}
