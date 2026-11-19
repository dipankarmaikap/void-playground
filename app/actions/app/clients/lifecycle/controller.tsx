import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { requireAuth } from 'remix/middleware/auth';

import { archiveClient, restoreClient } from '../../../../data/client-status.ts';
import type { User } from '../../../../data/db.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';

export default createController(routes.app.clients.lifecycle, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async archive(context) {
      let organization = context.get(CurrentOrganization);
      let client = await archiveClient(context.db, organization.id, context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      context.session.flash('message', 'Client archived');
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
    async restore(context) {
      let organization = context.get(CurrentOrganization);
      let client = await restoreClient(context.db, organization.id, context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      context.session.flash('message', 'Client restored');
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
