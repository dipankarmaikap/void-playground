import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient, listClients } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { parseInvoiceDraft } from '../../../../data/invoices/draft.ts';
import { todayInKolkata } from '../../../../data/invoices/dates.ts';
import { createDraftInvoice } from '../../../../data/invoices/records.ts';
import { ensureGstPresets, findGstPresets } from '../../../../data/organization-gst-presets.ts';
import { getInvoicingProfileView } from '../../../../data/organization-invoicing.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { isAddLineIntent, withAdditionalLine } from '../form-intent.ts';
import { draftFormValuesFor, readInvoiceFormValues } from '../form-values.ts';
import { NewInvoicePage } from './page.tsx';

export default createController(routes.app.invoices.new, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let directory = await listClients(organization.id, { status: 'active' });
      let clientId = context.url.searchParams.get('clientId') ?? '';
      let selectedClient = clientId ? await findClient(organization.id, clientId) : null;

      if (clientId && !selectedClient) return new Response('Client not found', { status: 404 });
      if (selectedClient?.status === 'archived') {
        return new Response('Client not found', { status: 404 });
      }

      let profile = selectedClient ? await getInvoicingProfileView(organization) : null;
      let gstRatePresets =
        profile?.gst_registered
          ? (await findGstPresets(organization.id)).map((preset) => preset.rate)
          : [];
      let values = selectedClient && profile
        ? draftFormValuesFor(selectedClient, profile, todayInKolkata())
        : undefined;

      return context.render(
        <NewInvoicePage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          clients={directory.clients}
          selectedClient={selectedClient ?? undefined}
          values={values}
          gstRatePresets={gstRatePresets}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let values = readInvoiceFormValues(context.formData);
      let profile = await getInvoicingProfileView(organization);
      let gstRatePresets = profile.gst_registered
        ? (await ensureGstPresets(organization.id)).map((preset) => preset.rate)
        : [];
      let taxConfig = {
        gstRegistered: profile.gst_registered,
        gstStateCode: profile.gst_state_code,
        gstRatePresets,
      };
      let identity = { email: auth.identity.email, displayName: auth.identity.display_name };
      let csrfToken = getCsrfToken(context);

      // A new Draft can only start from an Active Client in the resolved Organization. A foreign
      // id is indistinguishable from a missing one; an archived Client is rejected explicitly.
      let client = values.client_id ? await findClient(organization.id, values.client_id) : null;
      if (!client) return new Response('Client not found', { status: 404 });
      if (client.status === 'archived') {
        return context.render(
          <NewInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            clients={(await listClients(organization.id, { status: 'active' })).clients}
            selectedClient={client}
            values={values}
            gstRatePresets={gstRatePresets}
            issues={[
              {
                message: 'Archived Clients cannot be used for new invoices.',
                path: ['client_id'],
              },
            ]}
          />,
          { status: 400 },
        );
      }

      if (isAddLineIntent(context.formData)) {
        return context.render(
          <NewInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            clients={(await listClients(organization.id, { status: 'active' })).clients}
            selectedClient={client}
            values={withAdditionalLine(values)}
            gstRatePresets={gstRatePresets}
          />,
        );
      }

      let parsed = parseInvoiceDraft(values, taxConfig);
      if (!parsed.ok) {
        return context.render(
          <NewInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            clients={(await listClients(organization.id, { status: 'active' })).clients}
            selectedClient={client}
            values={values}
            issues={parsed.issues}
            gstRatePresets={gstRatePresets}
          />,
          { status: 400 },
        );
      }

      let invoice = await createDraftInvoice(organization.id, client.id, parsed.value);
      if (!invoice) return new Response('Invoice could not be created', { status: 500 });
      context.session.flash('message', 'Invoice draft created');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
