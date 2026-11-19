import { createController } from 'remix/router';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import type { User } from '../../data/db.ts';
import { requireAuth } from '../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../middleware/organization-context.ts';
import { routes } from '../../routes.ts';
import { DashboardPage } from './dashboard-page.tsx';

export default createController(routes.app, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async dashboard(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      return context.render(
        <DashboardPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
        />,
      );
    },
  },
});
