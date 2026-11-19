import type { Handle } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import { linkButtonStyle } from '../../../../ui/button.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { ClientForm } from '../client-form.tsx';
import { FormPageHeader } from '../form-page-header.tsx';
import { emptyClientFormValues } from '../form-values.ts';
import type { ClientFormValues } from '../form-values.ts';

export interface NewClientPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  values?: ClientFormValues;
  issues?: readonly Issue[];
}

export function NewClientPage(handle: Handle<NewClientPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      values = emptyClientFormValues(),
      issues,
    } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="clients"
        title="New client"
        description="Add a client profile to your Organization's client book."
      >
        <FormPageHeader
          eyebrow="Grow your circle"
          title="Add a client"
          intro="Save their details once and they will be ready for your next invoice."
          action={
            <a
              href={routes.app.clients.index.href()}
              data-variant="secondary"
              mix={linkButtonStyle}
            >
              Cancel
            </a>
          }
        />
        <ClientForm
          csrfToken={csrfToken}
          action={routes.app.clients.create.href()}
          submitLabel="Create client"
          cancelHref={routes.app.clients.index.href()}
          values={values}
          issues={issues}
        />
      </AppShell>
    );
  };
}
