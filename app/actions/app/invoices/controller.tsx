import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient } from '../../../data/clients.ts';
import type { User } from '../../../data/db.ts';
import { findInvoice, findInvoiceLines, listInvoices } from '../../../data/invoices.ts';
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
      let invoices = await listInvoices(organization.id);
      let message = context.session.get('message');

      return context.render(
        <InvoicesIndexPage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          invoices={invoices}
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
