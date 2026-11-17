import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { parseInvoiceDraft } from '../../../../data/invoice-draft.ts';
import { findInvoice, findInvoiceLines, updateDraftInvoice } from '../../../../data/invoices.ts';
import { ensureGstPresets, findGstPresets } from '../../../../data/organization-gst-presets.ts';
import { getInvoicingProfileView } from '../../../../data/organization-invoicing.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { isAddLineIntent, withAdditionalLine } from '../form-intent.ts';
import { invoiceFormValuesOf, readInvoiceFormValues } from '../form-values.ts';
import { EditInvoicePage } from './page.tsx';

export default createController(routes.app.invoices.edit, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });

      let [lines, client] = await Promise.all([
        findInvoiceLines(organization.id, invoice.id),
        findClient(organization.id, invoice.client_id),
      ]);
      let profile = await getInvoicingProfileView(organization);
      let gstRatePresets = profile.gst_registered
        ? (await findGstPresets(organization.id)).map((preset) => preset.rate)
        : [];
      return context.render(
        <EditInvoicePage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          invoice={invoice}
          client={client}
          lines={lines}
          values={invoiceFormValuesOf(invoice, lines)}
          gstRatePresets={gstRatePresets}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });

      let identity = { email: auth.identity.email, displayName: auth.identity.display_name };
      let csrfToken = getCsrfToken(context);
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
      let savedLines = await findInvoiceLines(organization.id, invoice.id);
      if (isAddLineIntent(context.formData)) {
        return context.render(
          <EditInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            invoice={invoice}
            client={await findClient(organization.id, invoice.client_id)}
            lines={savedLines}
            values={withAdditionalLine(values)}
            gstRatePresets={gstRatePresets}
          />,
        );
      }

      let parsed = parseInvoiceDraft(values, taxConfig);
      if (!parsed.ok) {
        let client = await findClient(organization.id, invoice.client_id);
        return context.render(
          <EditInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            invoice={invoice}
            client={client}
            lines={savedLines}
            values={values}
            issues={parsed.issues}
            gstRatePresets={gstRatePresets}
          />,
          { status: 400 },
        );
      }

      // The Client is fixed for this Draft; a forged `client_id` in the form is ignored.
      let updated = await updateDraftInvoice(organization.id, invoice.id, parsed.value);
      if (!updated) return new Response('Invoice not found', { status: 404 });

      context.session.flash('message', 'Invoice draft updated');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
