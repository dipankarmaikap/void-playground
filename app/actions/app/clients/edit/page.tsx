import type { Handle } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { clientDisplayLabel } from '../../../../data/client-names.ts';
import type { Client } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { ClientForm } from '../client-form.tsx';
import { FormPageHeader } from '../form-page-header.tsx';
import { clientFormValuesOf } from '../form-values.ts';
import type { ClientFormValues } from '../form-values.ts';

export interface EditClientPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  client: Client;
  values?: ClientFormValues;
  issues?: readonly Issue[];
}

export function EditClientPage(handle: Handle<EditClientPageProps>) {
  return () => {
    let { csrfToken, identity, organizationName, client, values, issues } = handle.props;
    let label = clientDisplayLabel(client);
    let showHref = routes.app.clients.show.href({ clientId: client.id });

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="clients"
        title={`Edit ${label}`}
        description={`Update the client profile for ${label} in your Organization's client book.`}
      >
        <FormPageHeader
          eyebrow="Client profile"
          title={`Edit ${label}`}
          intro="Changes apply to your Organization's Client book."
        />
        <ClientForm
          csrfToken={csrfToken}
          action={routes.app.clients.update.href({ clientId: client.id })}
          method="PUT"
          submitLabel="Save client"
          cancelHref={showHref}
          values={values ?? clientFormValuesOf(client)}
          issues={issues}
        />
      </AppShell>
    );
  };
}
