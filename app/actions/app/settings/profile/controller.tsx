import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
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
      return context.render(
        <ProfilePage
          csrfToken={csrfToken}
          email={identity.email}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    // The profile form arrives in the display-name ticket; the form route stays mapped.
    action() {
      return redirect(routes.app.settings.profile.index.href());
    },
  },
});
