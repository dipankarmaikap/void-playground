import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import type { User } from '../../../../data/db.ts';
import {
  addGstPreset,
  ensureGstPresets,
  findGstPresets,
  removeGstPreset,
  updateGstPreset,
} from '../../../../data/organization/gst-presets.ts';
import {
  getInvoicingProfileView,
  parseInvoicingProfile,
  saveInvoicingProfile,
} from '../../../../data/organization/invoicing.ts';
import { requireAuth } from '../../../../middleware/auth.ts';
import {
  CurrentOrganization,
  requireOrganizationContext,
} from '../../../../middleware/organization-context.ts';
import { routes } from '../../../../routes.ts';
import { invoicingFormValuesOf } from './form-values.ts';
import { invoicingValuesOf, presetValuesOf } from './public/schema.ts';
import { InvoicingPage } from './page.tsx';

function identityOf(auth: GoodAuth<User>) {
  return { email: auth.identity.email, displayName: auth.identity.display_name };
}

export default createController(routes.app.settings.invoicing, {
  middleware: [
    requireAuth(),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let [view, presets] = await Promise.all([
        getInvoicingProfileView(context.db, organization),
        findGstPresets(context.db, organization.id),
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
      let view = await getInvoicingProfileView(context.db, organization);

      if (form === 'preset_add' || form === 'preset_update' || form === 'preset_remove') {
        let presets = await ensureGstPresets(context.db, organization.id);
        let { rate, presetId } = presetValuesOf(context.formData);

        let result =
          form === 'preset_add'
            ? await addGstPreset(context.db, organization.id, rate)
            : form === 'preset_update'
              ? await updateGstPreset(context.db, organization.id, presetId, rate)
              : await removeGstPreset(context.db, organization.id, presetId).then((removed) => ({
                  ok: removed.found,
                  notFound: !removed.found,
                  message: undefined,
                }));

        if (result.notFound) return new Response('GST rate preset not found', { status: 404 });

        if (result.ok) {
          if (form === 'preset_remove') await ensureGstPresets(context.db, organization.id);
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

      let submitted = invoicingValuesOf(context.formData);
      let presets = await ensureGstPresets(context.db, organization.id);
      let parsed = parseInvoicingProfile(submitted, view);

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
      await saveInvoicingProfile(context.db, organization.id, parsed.value);
      context.session.flash('message', 'Invoicing settings updated');
      return redirect(routes.app.settings.invoicing.index.href());
    },
  },
});
