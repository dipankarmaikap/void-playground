import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient } from '../../../../data/clients.ts';
import type { User } from '../../../../data/db.ts';
import { parseInvoiceDraft } from '../../../../data/invoices/draft.ts';
import { findInvoice, findInvoiceLines, updateDraftInvoice } from '../../../../data/invoices/records.ts';
import { ensureGstPresets, findGstPresets } from '../../../../data/organization/gst-presets.ts';
import { getInvoicingProfileView } from '../../../../data/organization/invoicing.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { isAddLineIntent, withAdditionalLine } from '../form-intent.ts';
import { invoiceFormValuesOf } from '../form-values.ts';
import { parseInvoiceFormValues } from '../public/schema.ts';
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
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be edited', { status: 409 });
      }

      let [lines, client] = await Promise.all([
        findInvoiceLines(context.db, organization.id, invoice.id),
        findClient(context.db, organization.id, invoice.client_id),
      ]);
      let profile = await getInvoicingProfileView(context.db, organization);
      let gstRatePresets = profile.gst_registered
        ? (await findGstPresets(context.db, organization.id)).map((preset) => preset.rate)
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
      let invoice = await findInvoice(context.db, organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be edited', { status: 409 });
      }

      let identity = { email: auth.identity.email, displayName: auth.identity.display_name };
      let csrfToken = getCsrfToken(context);
      let { values, issues: formIssues } = parseInvoiceFormValues(context.formData);
      let profile = await getInvoicingProfileView(context.db, organization);
      let gstRatePresets = profile.gst_registered
        ? (await ensureGstPresets(context.db, organization.id)).map((preset) => preset.rate)
        : [];
      let taxConfig = {
        gstRegistered: profile.gst_registered,
        gstStateCode: profile.gst_state_code,
        gstRatePresets,
      };
      let savedLines = await findInvoiceLines(context.db, organization.id, invoice.id);
      if (isAddLineIntent(context.formData)) {
        return context.render(
          <EditInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            invoice={invoice}
            client={await findClient(context.db, organization.id, invoice.client_id)}
            lines={savedLines}
            values={withAdditionalLine(values)}
            gstRatePresets={gstRatePresets}
          />,
        );
      }

      if (formIssues.length > 0) {
        let client = await findClient(context.db, organization.id, invoice.client_id);
        return context.render(
          <EditInvoicePage
            csrfToken={csrfToken}
            identity={identity}
            organizationName={organization.name}
            invoice={invoice}
            client={client}
            lines={savedLines}
            values={values}
            issues={formIssues}
            gstRatePresets={gstRatePresets}
          />,
          { status: 400 },
        );
      }

      let parsed = parseInvoiceDraft(values, taxConfig);
      if (!parsed.ok) {
        let client = await findClient(context.db, organization.id, invoice.client_id);
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
      let updated = await updateDraftInvoice(context.db, organization.id, invoice.id, parsed.value);
      if (!updated) return new Response('Only a Draft invoice can be edited', { status: 409 });

      context.session.flash('message', 'Invoice draft updated');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
