import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { isClientType } from '../../../data/client-names.ts';
import {
  findClient,
  listClients,
  parseClientDirectoryPage,
} from '../../../data/clients.ts';
import type { ClientTypeFilter } from '../../../data/clients.ts';
import { parseClientStatusFilter } from '../../../data/client-status.ts';
import type { User } from '../../../data/db.ts';
import { countClientInvoices } from '../../../data/invoices/records.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../middleware/organization-context.ts';
import { routes } from '../../../routes.ts';
import { ClientsIndexPage } from './index-page.tsx';
import { ClientProfilePage } from './show-page.tsx';

export default createController(routes.app.clients, {
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
      let error = context.session.get('error');
      let message = context.session.get('message');
      let query = (context.url.searchParams.get('q') ?? '').trim();
      let typeParam = context.url.searchParams.get('type');
      let type: ClientTypeFilter = 'all';
      if (isClientType(typeParam)) type = typeParam;
      let status = parseClientStatusFilter(context.url.searchParams.get('status'));
      let page = parseClientDirectoryPage(context.url.searchParams.get('page'));
      let directory = await listClients(organization.id, { q: query, type, status, page });
      return context.render(
        <ClientsIndexPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
          clients={directory.clients}
          query={query}
          type={type}
          status={status}
          page={directory.page}
          hasPrevious={directory.hasPrevious}
          hasNext={directory.hasNext}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async show(context) {
      let organization = context.get(CurrentOrganization);
      let client = await findClient(organization.id, context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });
      let invoiceCount = await countClientInvoices(organization.id, client.id);

      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      return context.render(
        <ClientProfilePage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
          client={client}
          invoiceCount={invoiceCount}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
  },
});
