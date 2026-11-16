import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import type { User } from '../../../../data/db.ts';
import {
  addGstPreset,
  ensureGstPresets,
  removeGstPreset,
  updateGstPreset,
} from '../../../../data/organization-gst-presets.ts';
import {
  getInvoicingProfileView,
  parseInvoicingProfile,
  saveInvoicingProfile,
} from '../../../../data/organization-invoicing.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { invoicingFormValuesOf, readInvoicingFormValues } from './form-values.ts';
import { InvoicingPage } from './page.tsx';

function identityOf(auth: GoodAuth<User>) {
  return { email: auth.identity.email, displayName: auth.identity.display_name };
}

export default createController(routes.app.settings.invoicing, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let [view, presets] = await Promise.all([
        getInvoicingProfileView(organization),
        ensureGstPresets(organization.id),
      ]);
      let message = context.session.get('message');

      return context.render(
        <InvoicingPage
          csrfToken={getCsrfToken(context)}
          identity={identityOf(auth)}
          organizationName={organization.name}
          view={view}
          values={invoicingFormValuesOf(view)}
          presets={presets}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let form = context.formData.get('_form');
      let view = await getInvoicingProfileView(organization);

      if (form === 'preset_add' || form === 'preset_update' || form === 'preset_remove') {
        let presets = await ensureGstPresets(organization.id);
        let text = (name: string) => {
          let value = context.formData.get(name);
          return typeof value === 'string' ? value : '';
        };
        let rate = text('rate');
        let presetId = text('preset_id');

        let result =
          form === 'preset_add'
            ? await addGstPreset(organization.id, rate)
            : form === 'preset_update'
              ? await updateGstPreset(organization.id, presetId, rate)
              : await removeGstPreset(organization.id, presetId).then((removed) => ({
                  ok: removed.found,
                  notFound: !removed.found,
                  message: undefined,
                }));

        if (result.notFound) return new Response('GST rate preset not found', { status: 404 });

        if (result.ok) {
          context.session.flash(
            'message',
            form === 'preset_add'
              ? 'GST rate preset added'
              : form === 'preset_update'
                ? 'GST rate preset updated'
                : 'GST rate preset removed',
          );
          return redirect(routes.app.settings.invoicing.index.href());
        }

        return context.render(
          <InvoicingPage
            csrfToken={getCsrfToken(context)}
            identity={identityOf(auth)}
            organizationName={organization.name}
            view={view}
            values={invoicingFormValuesOf(view)}
            presets={presets}
            presetRate={rate}
            presetError={result.message}
            presetErrorId={form === 'preset_update' ? presetId : undefined}
            submitted
          />,
          { status: 400 },
        );
      }

      let submitted = readInvoicingFormValues(context.formData);
      let presets = await ensureGstPresets(organization.id);
      let parsed = parseInvoicingProfile(submitted);

      if (!parsed.ok) {
        return context.render(
          <InvoicingPage
            csrfToken={getCsrfToken(context)}
            identity={identityOf(auth)}
            organizationName={organization.name}
            view={view}
            values={submitted}
            presets={presets}
            issues={parsed.issues}
            submitted
          />,
          { status: 400 },
        );
      }

      // The Organization is resolved from the authenticated membership, never from form data.
      await saveInvoicingProfile(organization.id, parsed.value);
      context.session.flash('message', 'Invoicing settings updated');
      return redirect(routes.app.settings.invoicing.index.href());
    },
  },
});
