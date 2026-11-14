import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
import { parseDisplayName } from '../../../../data/display-name.ts';
import { routes } from '../../../../routes.ts';
import { ProfilePage } from './page.tsx';

const DISPLAY_NAME_DRAFT_FLASH_KEY = 'display_name_draft';

export default createController(routes.app.settings.profile, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      let draft = context.session.get(DISPLAY_NAME_DRAFT_FLASH_KEY);
      return context.render(
        <ProfilePage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          displayNameValue={typeof draft === 'string' ? draft : undefined}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
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
    },
  },
});
