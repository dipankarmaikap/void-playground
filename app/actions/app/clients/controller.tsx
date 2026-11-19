import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { isClientType } from '../../../data/client-names.ts';
import {
  createClient,
  findClient,
  listClients,
  parseClientDirectoryPage,
  updateClient,
} from '../../../data/clients.ts';
import type { ClientTypeFilter } from '../../../data/clients.ts';
import { parseClientStatusFilter } from '../../../data/client-status.ts';
import type { User } from '../../../data/db.ts';
import { countClientInvoices } from '../../../data/invoices/records.ts';
import { requireAuth } from '../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../middleware/organization-context.ts';
import { routes } from '../../../routes.ts';
import { EditClientPage } from './edit/page.tsx';
import { clientFormValuesOf, readClientFormValues } from './form-values.ts';
import { parseClientForm } from './parse-client-form.ts';
import { ClientsIndexPage } from './index-page.tsx';
import { NewClientPage } from './new/page.tsx';
import { ClientProfilePage } from './show-page.tsx';

export default createController(routes.app.clients, {
  middleware: [requireAuth(), requireOrganizationContext],
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
    async new(context) {
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
    async edit(context) {
      let organization = context.get(CurrentOrganization);
      let client = await findClient(organization.id, context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      return context.render(
        <EditClientPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          organizationName={organization.name}
          client={client}
          values={clientFormValuesOf(client)}
        />,
      );
    },
    async create(context) {
      let organization = context.get(CurrentOrganization);
      let { issues, changes, warning } = await parseClientForm(context.formData, {
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

      let client = await createClient(organization.id, changes);
      context.session.flash(
        'message',
        warning ? `Client created. ${warning}` : 'Client created',
      );
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
    async update(context) {
      let organization = context.get(CurrentOrganization);
      let client = await findClient(organization.id, context.params.clientId);
      if (!client) return new Response('Client not found', { status: 404 });

      let { issues, changes, warning } = await parseClientForm(context.formData, {
        organizationId: organization.id,
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
            organizationName={organization.name}
            client={client}
            values={readClientFormValues(context.formData)}
            issues={issues}
          />,
          { status: 400 },
        );
      }

      let updated = await updateClient(organization.id, client.id, changes);
      if (!updated) return new Response('Client not found', { status: 404 });
      context.session.flash(
        'message',
        warning ? `Client updated. ${warning}` : 'Client updated',
      );
      return redirect(routes.app.clients.show.href({ clientId: client.id }));
    },
  },
});
