import { db, organizationMemberships, organizations } from './db.ts';
import type { Organization, User } from './db.ts';

/** Finds the one Organization available to an authenticated User through membership. */
export async function findOrganizationForUser(
  user: Pick<User, 'id'>,
): Promise<Organization | null> {
  let memberships = await db.findMany(organizationMemberships, {
    where: { user_id: user.id },
    limit: 2,
  });
  if (memberships.length !== 1) return null;

  return db.find(organizations, memberships[0].organization_id);
}
