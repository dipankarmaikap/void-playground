import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { createClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { readClientFormValues } from '../form-values.ts';
import { clientFormSections } from '../sections/registry.ts';
import { NewClientPage } from './page.tsx';

export default createController(routes.app.clients.new, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      return context.render(
        <NewClientPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
        />,
      );
    },
    async action(context) {
      let parsed = await Promise.all(
        clientFormSections.map((section) => section.parse(context.formData)),
      );
      let issues = parsed.flatMap((result) => result.issues);
      let changes = Object.assign({}, ...parsed.map((result) => result.changes));
      let warning = parsed.find((result) => result.warning)?.warning;
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;

      if (issues.length > 0) {
        let csrfToken = getCsrfToken(context);
        return context.render(
          <NewClientPage
            csrfToken={csrfToken}
            identity={{ email: identity.email, displayName: identity.display_name }}
            values={readClientFormValues(context.formData)}
            issues={issues}
          />,
          { status: 400 },
        );
      }

      let client = await createClient(changes);
      context.session.flash(
        'message',
        warning ? `Client created. ${warning}` : 'Client created',
      );
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
