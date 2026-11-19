import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
import { parseDisplayName } from '../../../../data/display-name.ts';
import { parseOrganizationName } from '../../../../data/organization/name.ts';
import { renameOwnedOrganizationForUser } from '../../../../data/organization/access.ts';
import { requireAuth } from '../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { ProfilePage } from './page.tsx';

const DISPLAY_NAME_DRAFT_FLASH_KEY = 'display_name_draft';
const ORGANIZATION_NAME_DRAFT_FLASH_KEY = 'organization_name_draft';
const ORGANIZATION_ERROR_FLASH_KEY = 'organization_error';
const ORGANIZATION_MESSAGE_FLASH_KEY = 'organization_message';

export default createController(routes.app.settings.profile, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      let draft = context.session.get(DISPLAY_NAME_DRAFT_FLASH_KEY);
      let organizationDraft = context.session.get(ORGANIZATION_NAME_DRAFT_FLASH_KEY);
      let organizationError = context.session.get(ORGANIZATION_ERROR_FLASH_KEY);
      let organizationMessage = context.session.get(ORGANIZATION_MESSAGE_FLASH_KEY);
      return context.render(
        <ProfilePage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
          organizationNameValue={
            typeof organizationDraft === 'string' ? organizationDraft : undefined
          }
          organizationError={
            typeof organizationError === 'string' ? organizationError : undefined
          }
          organizationMessage={
            typeof organizationMessage === 'string' ? organizationMessage : undefined
          }
          displayNameValue={typeof draft === 'string' ? draft : undefined}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;

      async function renameOrganization() {
        let value = context.formData.get('organization_name');
        let submitted = typeof value === 'string' ? value : '';
        let parsed = parseOrganizationName(submitted);

        if (!parsed.ok) {
          context.session.flash(ORGANIZATION_ERROR_FLASH_KEY, parsed.error);
          context.session.flash(ORGANIZATION_NAME_DRAFT_FLASH_KEY, submitted);
          return redirect(routes.app.settings.profile.index.href());
        }

        let organization = await renameOwnedOrganizationForUser(auth.identity, parsed.value);
        if (!organization) {
          return new Response('Organization owner access unavailable', { status: 403 });
        }

        context.session.flash(ORGANIZATION_MESSAGE_FLASH_KEY, 'Organization name updated');
        return redirect(routes.app.settings.profile.index.href());
      }

      async function updateDisplayName() {
        let value = context.formData.get('display_name');
        let submitted = typeof value === 'string' ? value : '';
        let parsed = parseDisplayName(submitted);

        if (!parsed.ok) {
          context.session.flash('error', parsed.error);
          context.session.flash(DISPLAY_NAME_DRAFT_FLASH_KEY, submitted);
          return redirect(routes.app.settings.profile.index.href());
        }

        await db.update(users, auth.identity.id, { display_name: parsed.value });
        context.session.flash('message', 'Profile updated');
        return redirect(routes.app.settings.profile.index.href());
      }

      if (context.formData.has('organization_name')) {
        return renameOrganization();
      }

      return updateDisplayName();
    },
  },
});
