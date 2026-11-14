import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient, updateClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { clientFormValuesOf, readClientFormValues } from '../form-values.ts';
import { parseClientForm } from '../parse-client-form.ts';
import { EditClientPage } from './page.tsx';

export default createController(routes.app.clients.edit, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let client = await findClient(context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      return context.render(
        <EditClientPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          client={client}
          values={clientFormValuesOf(client)}
        />,
      );
    },
    async action(context) {
      let client = await findClient(context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      let { issues, changes, warning } = await parseClientForm(context.formData, {
        clientId: client.id,
      });
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;

      if (issues.length > 0) {
        let csrfToken = getCsrfToken(context);
        return context.render(
          <EditClientPage
            csrfToken={csrfToken}
            identity={{ email: identity.email, displayName: identity.display_name }}
            client={client}
            values={readClientFormValues(context.formData)}
            issues={issues}
          />,
          { status: 400 },
        );
      }

      await updateClient(client.id, changes);
      context.session.flash(
        'message',
        warning ? `Client updated. ${warning}` : 'Client updated',
      );
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
