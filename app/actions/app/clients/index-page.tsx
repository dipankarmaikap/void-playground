import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../../../config.ts';
import { clientTypeLabel } from '../../../data/client-names.ts';
import { clientDisplayName } from '../../../data/clients.ts';
import type { Client } from '../../../data/db.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { linkButtonStyle } from '../../../ui/button.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import {
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../ui/page-styles.ts';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface ClientsIndexPageProps {
  csrfToken: string;
  identity: UserIdentity;
  clients: Client[];
  error?: string;
  message?: string;
}

const toolbarStyle = css({
  marginBottom: '1.25rem',
});

const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.75rem',
});

const itemStyle = css({
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const itemLinkStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '1rem 1.25rem',
  color: colors.text,
  textDecoration: 'none',
  '&:hover': {
    background: colors.accentSoft,
  },
});

const nameStyle = css({
  fontSize: '1rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
});

const metaStyle = css({
  color: colors.muted,
  fontSize: '0.8125rem',
});

const emptyStyle = css({
  margin: 0,
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  color: colors.muted,
  fontSize: '0.9375rem',
});

export function ClientsIndexPage(handle: Handle<ClientsIndexPageProps>) {
  return () => {
    let { csrfToken, identity, clients, error, message } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        section="clients"
        title="Clients"
        description={`Manage the people and businesses in the shared ${APP_NAME} client book.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Clients</h1>
          <p mix={pageIntroStyle}>
            One shared client book. Every signed-in user can view and edit these profiles.
          </p>
        </header>
        {error ? (
          <p role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" mix={[noticeStatusStyle, noticeSpacingStyle]}>
            {message}
          </p>
        ) : null}
        <div mix={toolbarStyle}>
          <a href={routes.app.clients.new.index.href()} mix={linkButtonStyle}>
            New client
          </a>
        </div>
        {clients.length === 0 ? (
          <p mix={emptyStyle}>No active clients yet. Add your first client to get started.</p>
        ) : (
          <ul mix={listStyle}>
            {clients.map((client) => {
              let label = clientDisplayName(client);
              return (
                <li key={client.id} mix={itemStyle}>
                  <a
                    href={routes.app.clients.show.href({ clientId: client.id })}
                    mix={itemLinkStyle}
                  >
                    <span mix={nameStyle}>{label}</span>
                    <span mix={metaStyle}>{clientTypeLabel(client.type)}</span>
                    {label === client.legal_name ? null : (
                      <span mix={metaStyle}>{client.legal_name}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </AppShell>
    );
  };
}
