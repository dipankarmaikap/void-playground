import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { hasClientContacts } from '../../../../data/client-contacts.ts';
import type { Client } from '../../../../data/db.ts';
import { colors, radius, shadow } from '../../../../ui/theme.ts';

export interface ClientContactSummaryProps {
  client: Client;
}

const cardStyle = css({
  marginTop: '1rem',
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

export function ClientContactSummary(handle: Handle<ClientContactSummaryProps>) {
  return () => {
    let { client } = handle.props;
    if (!hasClientContacts(client)) return null;

    let hasPrimaryContact = Boolean(
      client.contact_name || client.contact_role || client.contact_email || client.contact_phone,
    );

    return (
      <section aria-labelledby="client-contacts-heading" mix={cardStyle}>
        <h2 id="client-contacts-heading" mix={cardHeadingStyle}>
          Contacts
        </h2>
        <dl mix={listStyle}>
          {client.email ? (
            <div>
              <dt mix={termStyle}>Email</dt>
              <dd mix={detailStyle}>{client.email}</dd>
            </div>
          ) : null}
          {client.phone ? (
            <div>
              <dt mix={termStyle}>Phone</dt>
              <dd mix={detailStyle}>{client.phone}</dd>
            </div>
          ) : null}
          {hasPrimaryContact ? (
            <div>
              <dt mix={termStyle}>Primary contact</dt>
              <dd mix={detailStyle}>
                {client.contact_name}
                {client.contact_role ? ` — ${client.contact_role}` : null}
              </dd>
            </div>
          ) : null}
          {client.contact_email ? (
            <div>
              <dt mix={termStyle}>Contact email</dt>
              <dd mix={detailStyle}>{client.contact_email}</dd>
            </div>
          ) : null}
          {client.contact_phone ? (
            <div>
              <dt mix={termStyle}>Contact phone</dt>
              <dd mix={detailStyle}>{client.contact_phone}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    );
  };
}
