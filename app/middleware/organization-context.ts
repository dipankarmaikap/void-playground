import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';
import { createContextKey } from 'remix/router';
import type { Middleware } from 'remix/router';

import type { Organization, User } from '../data/db.ts';
import { findOrganizationForUser } from '../data/organization/access.ts';

export const CurrentOrganization = createContextKey<Organization>();

/** Resolve the Organization for an authenticated User; never choose from request data. */
export const requireOrganizationContext: Middleware<{
  key: typeof CurrentOrganization;
  value: Organization;
}> = async (context, next) => {
  let auth = context.get(Auth) as AuthState<User> | undefined;
  if (!auth?.ok) return new Response('Organization access unavailable', { status: 403 });

  let organization = await findOrganizationForUser(auth.identity);
  if (!organization) {
    return new Response('Organization access unavailable', { status: 403 });
  }

  context.set(CurrentOrganization, organization);
  return next();
};
