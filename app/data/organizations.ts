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

/** Renames the one Organization an authenticated owner is associated with. */
export async function renameOwnedOrganizationForUser(
  user: Pick<User, 'id'>,
  name: string,
): Promise<Organization | null> {
  let memberships = await db.findMany(organizationMemberships, {
    where: { user_id: user.id },
    limit: 2,
  });
  if (memberships.length !== 1 || !memberships[0].is_owner) return null;

  let organization = await db.find(organizations, memberships[0].organization_id);
  if (!organization) return null;

  await db.update(organizations, organization.id, {
    name,
    updated_at: Date.now(),
  });
  return db.find(organizations, organization.id);
}
