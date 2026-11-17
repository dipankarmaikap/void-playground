import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { clientDisplayLabel } from '../../../../data/client-names.ts';
import type { ClientDirectoryItem } from '../../../../data/clients.ts';
import type { Client } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors, radius } from '../../../../ui/theme.ts';
import type { InvoiceFormValues } from '../form-values.ts';
import { InvoiceForm } from '../invoice-form.tsx';

export interface NewInvoicePageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  clients: ClientDirectoryItem[];
  selectedClient?: Client;
  values?: InvoiceFormValues;
  issues?: readonly Issue[];
  gstRatePresets: readonly string[];
}

const cardStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
});

const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.5rem',
});

const clientLinkStyle = css({
  display: 'block',
  padding: '0.75rem 1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  color: colors.text,
  textDecoration: 'none',
  '&:hover': { background: colors.accentSoft },
});

const hintStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.875rem',
});

export function NewInvoicePage(handle: Handle<NewInvoicePageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      clients,
      selectedClient,
      values,
      issues,
      gstRatePresets,
    } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title="New invoice draft"
        description="Start a draft invoice for an Active Client in your Organization."
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>New invoice draft</h1>
          <p mix={pageIntroStyle}>
            {selectedClient
              ? 'Recipient details are prefilled from the Client and your Organization defaults. Every field stays editable on this draft.'
              : 'Choose an Active Client to prefill the draft from its profile and your Organization defaults.'}
          </p>
        </header>
        {selectedClient ? (
          <InvoiceForm
            csrfToken={csrfToken}
            action={routes.app.invoices.new.action.href()}
            submitLabel="Create draft"
            values={values!}
            issues={issues}
            gstRatePresets={gstRatePresets}
          >
            <p mix={hintStyle}>Bill to: {clientDisplayLabel(selectedClient)}</p>
          </InvoiceForm>
        ) : (
          <section aria-labelledby="choose-client-heading" mix={cardStyle}>
            <h2 id="choose-client-heading">Choose an Active Client</h2>
            {clients.length === 0 ? (
              <p mix={hintStyle}>
                No Active Clients yet. Add a Client in the Clients area before starting a draft.
              </p>
            ) : (
              <ul mix={listStyle}>
                {clients.map((client) => (
                  <li key={client.id}>
                    <a
                      href={routes.app.invoices.new.index.href({}, {
                        searchParams: { clientId: client.id },
                      })}
                      mix={clientLinkStyle}
                    >
                      {clientDisplayLabel(client)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </AppShell>
    );
  };
}
