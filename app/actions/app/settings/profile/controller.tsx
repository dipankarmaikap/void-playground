import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
import { DISPLAY_NAME_MAX_LENGTH } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';
import { ProfilePage } from './page.tsx';

export default createController(routes.app.settings.profile, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let user = await db.find(users, auth.identity.id);
      let identity = user ?? auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      let draft = context.session.get('display_name_draft');
      return context.render(
        <ProfilePage
          csrfToken={csrfToken}
          email={identity.email}
          displayName={identity.display_name}
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
      let displayName = submitted.trim();

      if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
        context.session.flash(
          'error',
          `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
        );
        context.session.flash('display_name_draft', submitted);
        return redirect(routes.app.settings.profile.index.href());
      }

      await db.update(users, auth.identity.id, { display_name: displayName || null });
      context.session.flash('message', 'Profile updated');
      return redirect(routes.app.settings.profile.index.href());
    },
  },
});
