import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient } from '../../../data/clients.ts';
import type { User } from '../../../data/db.ts';
import {
  findInvoice,
  findInvoiceLines,
  listInvoices,
  parseInvoiceDirectoryDateFilter,
  parseInvoiceDirectoryPage,
  parseInvoiceStatusFilter,
} from '../../../data/invoices.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../middleware/organization-context.ts';
import { routes } from '../../../routes.ts';
import { InvoicesIndexPage } from './index-page.tsx';
import { InvoiceShowPage } from './show-page.tsx';

export default createController(routes.app.invoices, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let query = (context.url.searchParams.get('q') ?? '').trim();
      let clientId = (context.url.searchParams.get('clientId') ?? '').trim();
      let filteredClient = clientId ? await findClient(organization.id, clientId) : null;
      let status = parseInvoiceStatusFilter(context.url.searchParams.get('status'));
      let from = parseInvoiceDirectoryDateFilter(context.url.searchParams.get('from'));
      let to = parseInvoiceDirectoryDateFilter(context.url.searchParams.get('to'));
      let directory = await listInvoices(organization.id, {
        q: query,
        clientId,
        status,
        from,
        to,
        page: parseInvoiceDirectoryPage(context.url.searchParams.get('page')),
      });
      let message = context.session.get('message');

      return context.render(
        <InvoicesIndexPage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          invoices={directory.invoices}
          clientId={clientId}
          clientName={filteredClient?.legal_name}
          query={query}
          status={status}
          from={from}
          to={to}
          page={directory.page}
          hasPrevious={directory.hasPrevious}
          hasNext={directory.hasNext}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async show(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });

      let [lines, client] = await Promise.all([
        findInvoiceLines(organization.id, invoice.id),
        findClient(organization.id, invoice.client_id),
      ]);
      let message = context.session.get('message');
      return context.render(
        <InvoiceShowPage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          invoice={invoice}
          lines={lines}
          client={client}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
  },
});
