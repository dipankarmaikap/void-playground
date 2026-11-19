import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { createClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { readClientFormValues } from '../form-values.ts';
import { parseClientForm } from '../parse-client-form.ts';
import { NewClientPage } from './page.tsx';

export default createController(routes.app.clients.new, {
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
      return context.render(
        <NewClientPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
        />,
      );
    },
    async action(context) {
      let organization = context.get(CurrentOrganization);
      let { issues, changes, warning } = await parseClientForm(context.formData, {
        db: context.db,
        organizationId: organization.id,
      });
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;

      if (issues.length > 0) {
        let csrfToken = getCsrfToken(context);
        return context.render(
          <NewClientPage
            csrfToken={csrfToken}
            identity={{ email: identity.email, displayName: identity.display_name }}
            organizationName={organization.name}
            values={readClientFormValues(context.formData)}
            issues={issues}
          />,
          { status: 400 },
        );
      }

      let client = await createClient(context.db, organization.id, changes);
      context.session.flash(
        'message',
        warning ? `Client created. ${warning}` : 'Client created',
      );
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
