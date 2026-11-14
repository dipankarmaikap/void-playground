export interface UserIdentity {
  email: string;
  displayName?: string | null;
}

export interface Identity {
  /** The display name when one is set, otherwise the email address. */
  name: string;
  /** The email address, shown beneath the name only when a display name is set. */
  email: string | null;
}

export function identityOf(identity: UserIdentity): Identity {
  let displayName = identity.displayName?.trim() || null;
  return displayName
    ? { name: displayName, email: identity.email }
    : { name: identity.email, email: null };
}
