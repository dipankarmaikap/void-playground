import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import type { User } from '../../data/db.ts';
import { routes } from '../../routes.ts';
import { DashboardPage } from './dashboard-page.tsx';

export default createController(routes.app, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async dashboard(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      return context.render(
        <DashboardPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
        />,
      );
    },
  },
});
