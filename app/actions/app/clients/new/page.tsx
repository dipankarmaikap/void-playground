import type { Handle } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { APP_NAME } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { pageHeaderStyle, pageHeadingStyle, pageIntroStyle } from '../../../../ui/page-styles.ts';
import { ClientForm } from '../client-form.tsx';
import { emptyClientFormValues } from '../form-values.ts';
import type { ClientFormValues } from '../form-values.ts';

export interface NewClientPageProps {
  csrfToken: string;
  identity: UserIdentity;
  values?: ClientFormValues;
  issues?: readonly Issue[];
}

export function NewClientPage(handle: Handle<NewClientPageProps>) {
  return () => {
    let { csrfToken, identity, values = emptyClientFormValues(), issues } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        section="clients"
        title="New client"
        description={`Add a profile to the shared ${APP_NAME} client book.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>New client</h1>
          <p mix={pageIntroStyle}>
            Only the type and legal name are required. You can add more details later.
          </p>
        </header>
        <ClientForm
          csrfToken={csrfToken}
          action={routes.app.clients.new.action.href()}
          submitLabel="Create client"
          values={values}
          issues={issues}
        />
      </AppShell>
    );
  };
}
