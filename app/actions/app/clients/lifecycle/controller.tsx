import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { requireAuth } from 'remix/middleware/auth';

import { archiveClient, restoreClient } from '../../../../data/client-status.ts';
import { findClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';

export default createController(routes.app.clients.lifecycle, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async archive(context) {
      let client = await findClient(context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      await archiveClient(client.id);
      context.session.flash('message', 'Client archived');
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
    async restore(context) {
      let client = await findClient(context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      await restoreClient(client.id);
      context.session.flash('message', 'Client restored');
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
