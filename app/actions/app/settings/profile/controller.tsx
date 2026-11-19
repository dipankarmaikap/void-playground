import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';
import * as s from 'remix/data-schema';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { users } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
import { parseDisplayName } from '../../../../data/display-name.ts';
import { parseOrganizationName } from '../../../../data/organization/name.ts';
import { renameOwnedOrganizationForUser } from '../../../../data/organization/access.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { ProfilePage } from './page.tsx';
import { DisplayNameForm, OrganizationNameForm } from './public/schema.ts';

const DISPLAY_NAME_DRAFT_FLASH_KEY = 'display_name_draft';
const ORGANIZATION_NAME_DRAFT_FLASH_KEY = 'organization_name_draft';
const ORGANIZATION_ERROR_FLASH_KEY = 'organization_error';
const ORGANIZATION_MESSAGE_FLASH_KEY = 'organization_message';

export default createController(routes.app.settings.profile, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
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
        let parsed = s.parseSafe(OrganizationNameForm, context.formData);
        let submitted = parsed.success ? parsed.value.organization_name : '';
        let result = parseOrganizationName(submitted);

        if (!result.ok) {
          context.session.flash(ORGANIZATION_ERROR_FLASH_KEY, result.error);
          context.session.flash(ORGANIZATION_NAME_DRAFT_FLASH_KEY, submitted);
          return redirect(routes.app.settings.profile.index.href());
        }

        let organization = await renameOwnedOrganizationForUser(context.db, auth.identity, result.value);
        if (!organization) {
          return new Response('Organization owner access unavailable', { status: 403 });
        }

        context.session.flash(ORGANIZATION_MESSAGE_FLASH_KEY, 'Organization name updated');
        return redirect(routes.app.settings.profile.index.href());
      }

      async function updateDisplayName() {
        let parsed = s.parseSafe(DisplayNameForm, context.formData);
        let submitted = parsed.success ? parsed.value.display_name : '';
        let result = parseDisplayName(submitted);

        if (!result.ok) {
          context.session.flash('error', result.error);
          context.session.flash(DISPLAY_NAME_DRAFT_FLASH_KEY, submitted);
          return redirect(routes.app.settings.profile.index.href());
        }

        await context.db.update(users, auth.identity.id, { display_name: result.value });
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
