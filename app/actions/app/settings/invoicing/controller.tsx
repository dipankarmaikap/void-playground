import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth, requireAuth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import type { User } from '../../../../data/db.ts';
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

export default createController(routes.app.settings.invoicing, {
  middleware: [
    requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) }),
    requireOrganizationContext,
  ],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let view = await getInvoicingProfileView(organization);
      let message = context.session.get('message');

      return context.render(
        <InvoicingPage
          csrfToken={getCsrfToken(context)}
          identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
          organizationName={organization.name}
          view={view}
          values={invoicingFormValuesOf(view)}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let organization = context.get(CurrentOrganization);
      let submitted = readInvoicingFormValues(context.formData);
      let view = await getInvoicingProfileView(organization);
      let parsed = parseInvoicingProfile(submitted);

      if (!parsed.ok) {
        return context.render(
          <InvoicingPage
            csrfToken={getCsrfToken(context)}
            identity={{ email: auth.identity.email, displayName: auth.identity.display_name }}
            organizationName={organization.name}
            view={view}
            values={submitted}
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
