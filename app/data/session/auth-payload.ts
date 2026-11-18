import type { Session } from 'remix/session';

/** Session key under which the authenticated payload is stored. */
export const AUTH_SESSION_KEY = 'auth';

/**
 * The authenticated payload of a Session: the id of the signed-in User.
 * Login writes it after `completeAuth()` rotates the Session id; the auth
 * scheme and the hybrid session storage read it back.
 */
export interface AuthPayload {
  userId: string;
}

/**
 * Read the payload as written at login. Returns null when the Session has
 * no auth record, which leaves the request anonymous.
 */
export function readAuthPayload(session: Session): AuthPayload | null {
  return (session.get(AUTH_SESSION_KEY) as AuthPayload | undefined) ?? null;
}

/** Write the authenticated payload into a Session. */
export function setAuthPayload(session: Session, payload: AuthPayload): void {
  session.set(AUTH_SESSION_KEY, payload);
}
