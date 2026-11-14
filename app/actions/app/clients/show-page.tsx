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

export interface ClientProfilePageProps {
  csrfToken: string;
  identity: UserIdentity;
  client: Client;
  error?: string;
  message?: string;
}

const cardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const cardHeadingStyle = css({
  margin: '0 0 1rem',
  fontSize: '1rem',
});

const listStyle = css({
  margin: 0,
  display: 'grid',
  gap: '0.75rem',
});

const termStyle = css({
  color: colors.muted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
});

const detailStyle = css({
  margin: '0.125rem 0 0',
  fontSize: '0.9375rem',
  overflowWrap: 'anywhere',
});

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '1rem',
  marginTop: '1.25rem',
});

const backLinkStyle = css({
  color: colors.muted,
  fontSize: '0.875rem',
  textDecoration: 'none',
  '&:hover': {
    color: colors.text,
    textDecoration: 'underline',
  },
});

export function ClientProfilePage(handle: Handle<ClientProfilePageProps>) {
  return () => {
    let { csrfToken, identity, client, error, message } = handle.props;
    let label = clientDisplayName(client);

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        section="clients"
        title={label}
        description={`View the ${clientTypeLabel(client.type)} client profile for ${label} in the shared ${APP_NAME} client book.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>{label}</h1>
          <p mix={pageIntroStyle}>{clientTypeLabel(client.type)} client profile</p>
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
        <section aria-labelledby="client-identity-heading" mix={cardStyle}>
          <h2 id="client-identity-heading" mix={cardHeadingStyle}>
            Identity
          </h2>
          <dl mix={listStyle}>
            <div>
              <dt mix={termStyle}>Type</dt>
              <dd mix={detailStyle}>{clientTypeLabel(client.type)}</dd>
            </div>
            <div>
              <dt mix={termStyle}>Legal name</dt>
              <dd mix={detailStyle}>{client.legal_name}</dd>
            </div>
            {client.preferred_name ? (
              <div>
                <dt mix={termStyle}>Preferred name</dt>
                <dd mix={detailStyle}>{client.preferred_name}</dd>
              </div>
            ) : null}
            {client.trading_name ? (
              <div>
                <dt mix={termStyle}>Trading name</dt>
                <dd mix={detailStyle}>{client.trading_name}</dd>
              </div>
            ) : null}
            <div>
              <dt mix={termStyle}>Status</dt>
              <dd mix={detailStyle}>{client.status === 'active' ? 'Active' : 'Archived'}</dd>
            </div>
          </dl>
        </section>
        <div mix={actionsStyle}>
          <a
            href={routes.app.clients.edit.index.href({ clientId: client.id })}
            mix={linkButtonStyle}
          >
            Edit client
          </a>
          <a href={routes.app.clients.index.href()} mix={backLinkStyle}>
            Back to clients
          </a>
        </div>
      </AppShell>
    );
  };
}
