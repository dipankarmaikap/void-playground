import type { Handle } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { APP_NAME } from '../../../../config.ts';
import { clientDisplayName } from '../../../../data/clients.ts';
import type { Client } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { pageHeaderStyle, pageHeadingStyle, pageIntroStyle } from '../../../../ui/page-styles.ts';
import { ClientForm } from '../client-form.tsx';
import { clientFormValuesOf } from '../form-values.ts';
import type { ClientFormValues } from '../form-values.ts';

export interface EditClientPageProps {
  csrfToken: string;
  identity: UserIdentity;
  client: Client;
  values?: ClientFormValues;
  issues?: readonly Issue[];
}

export function EditClientPage(handle: Handle<EditClientPageProps>) {
  return () => {
    let { csrfToken, identity, client, values, issues } = handle.props;
    let label = clientDisplayName(client);

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        section="clients"
        title={`Edit ${label}`}
        description={`Update the client profile for ${label} in the shared ${APP_NAME} client book.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Edit {label}</h1>
          <p mix={pageIntroStyle}>Changes apply to the shared client book.</p>
        </header>
        <ClientForm
          csrfToken={csrfToken}
          action={routes.app.clients.edit.action.href({ clientId: client.id })}
          submitLabel="Save client"
          values={values ?? clientFormValuesOf(client)}
          issues={issues}
        />
      </AppShell>
    );
  };
}
