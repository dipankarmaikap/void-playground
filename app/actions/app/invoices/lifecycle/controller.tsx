import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { requireAuth } from 'remix/middleware/auth';

import type { User } from '../../../../data/db.ts';
import { discardDraftInvoice, findInvoice } from '../../../../data/invoices.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';

export default createController(routes.app.invoices.lifecycle, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async discard(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });

      let discarded = await discardDraftInvoice(organization.id, invoice.id);
      if (!discarded) return new Response('Invoice not found', { status: 404 });

      context.session.flash('message', 'Invoice draft discarded');
      return redirect(routes.app.invoices.index.href());
    },
  },
});
