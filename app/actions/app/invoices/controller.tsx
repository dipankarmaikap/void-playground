import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { findClient, listClients } from '../../../data/clients.ts';
import type { User } from '../../../data/db.ts';
import { parseInvoiceDraft } from '../../../data/invoices/draft.ts';
import { todayInKolkata } from '../../../data/invoices/dates.ts';
import {
  createDraftInvoice,
  findInvoice,
  findInvoiceLines,
  listInvoices,
  parseInvoiceDirectoryDateFilter,
  parseInvoiceDirectoryPage,
  parseInvoiceStatusFilter,
  updateDraftInvoice,
} from '../../../data/invoices/records.ts';
import {
  findIssuedInvoicePdfBytes,
  invoicePdfFilename,
} from '../../../data/invoices/pdf-artifacts.ts';
import { invoiceActivityData } from '../../../data/invoices/payments.ts';
import {
  renderInvoicePdf,
  sellerFromInvoicingProfile,
} from '../../../data/invoices/pdf.ts';
import { ensureGstPresets, findGstPresets } from '../../../data/organization/gst-presets.ts';
import { getInvoicingProfileView } from '../../../data/organization/invoicing.ts';
import { requireAuth } from '../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../middleware/organization-context.ts';
import { routes } from '../../../routes.ts';
import { EditInvoicePage } from './edit/page.tsx';
import { isAddLineIntent, withAdditionalLine } from './form-intent.ts';
import {
  draftFormValuesFor,
  invoiceFormValuesOf,
  readInvoiceFormValues,
} from './form-values.ts';
import { InvoicesIndexPage } from './index-page.tsx';
import { NewInvoicePage } from './new/page.tsx';
import { InvoiceShowPage } from './show-page.tsx';

export default createController(routes.app.invoices, {
  middleware: [
    requireAuth(),
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

      let [lines, client, paymentData] = await Promise.all([
        findInvoiceLines(organization.id, invoice.id),
        findClient(organization.id, invoice.client_id),
        invoiceActivityData(organization.id, invoice),
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
          {...paymentData}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async pdf(context) {
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });

      let filename = invoicePdfFilename(invoice);

      // Issued invoices download the exact bytes preserved at issue time; a missing artifact is a
      // 404 rather than a regeneration so the historical document can never drift.
      if (invoice.status !== 'draft') {
        let stored = await findIssuedInvoicePdfBytes(organization.id, invoice.id);
        if (!stored) return new Response('Invoice PDF not found', { status: 404 });
        return new Response(new Blob([stored as BlobPart]), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
          },
        });
      }

      // Drafts render on the fly, watermarked, showing DRAFT instead of a final number, and never
      // mutate the Draft or allocate a number. The private internal note is stripped here so it
      // cannot reach the renderer.
      let { internal_note: _internalNote, ...draftDocument } = invoice;
      let [lines, profileView] = await Promise.all([
        findInvoiceLines(organization.id, invoice.id),
        getInvoicingProfileView(organization),
      ]);
      let pdf = renderInvoicePdf({
        invoice: draftDocument,
        lines,
        seller: sellerFromInvoicingProfile(profileView),
        watermark: true,
      });
      return new Response(new Blob([pdf as BlobPart]), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    },
    async new(context) {
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
    async edit(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be edited', { status: 409 });
      }

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
    async create(context) {
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
    async update(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let invoice = await findInvoice(organization.id, context.params.invoiceId);
      if (!invoice) return new Response('Invoice not found', { status: 404 });
      if (invoice.status !== 'draft') {
        return new Response('Issued invoices cannot be edited', { status: 409 });
      }

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
      if (!updated) return new Response('Only a Draft invoice can be edited', { status: 409 });

      context.session.flash('message', 'Invoice draft updated');
      return redirect(routes.app.invoices.show.href({ invoiceId: invoice.id }));
    },
  },
});
