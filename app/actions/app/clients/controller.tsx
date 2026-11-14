import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient, listClients } from '../../../data/clients.ts';
import type { User } from '../../../data/db.ts';
import { routes } from '../../../routes.ts';
import { ClientsIndexPage } from './index-page.tsx';
import { ClientProfilePage } from './show-page.tsx';

export default createController(routes.app.clients, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      let clients = await listClients();
      return context.render(
        <ClientsIndexPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          clients={clients}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async show(context) {
      let client = await findClient(context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      return context.render(
        <ClientProfilePage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          client={client}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
  },
});
