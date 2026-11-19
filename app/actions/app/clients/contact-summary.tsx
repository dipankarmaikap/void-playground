import type { Handle } from 'remix/component';

import type { Client } from '../../../data/db.ts';
import { SummaryList, SummaryPanel, SummaryRow } from './summary-list.tsx';

export interface ClientContactSummaryProps {
  client: Client;
}

export function ClientContactSummary(handle: Handle<ClientContactSummaryProps>) {
  return () => {
    let { client } = handle.props;

    // A primary contact belongs to a Business; Individual profiles only show the shared
    // email and phone, while preserved business-only values stay in storage.
    let isBusiness = client.type === 'business';
    let hasPrimaryContact =
      isBusiness &&
      Boolean(
        client.contact_name ||
          client.contact_role ||
          client.contact_email ||
          client.contact_phone,
      );
    let hasVisibleContacts = Boolean(
      client.email ||
        client.phone ||
        hasPrimaryContact ||
        (isBusiness && (client.contact_email || client.contact_phone)),
    );
    if (!hasVisibleContacts) return null;

    return (
      <SummaryPanel
        title="Contact details"
        headingId="client-contacts-heading"
        subtitle="The best ways to reach this client."
      >
        <SummaryList>
          {client.email ? <SummaryRow term="Email">{client.email}</SummaryRow> : null}
          {client.phone ? <SummaryRow term="Phone">{client.phone}</SummaryRow> : null}
          {hasPrimaryContact ? (
            <SummaryRow term="Primary contact">
              {client.contact_name}
              {client.contact_role ? ` — ${client.contact_role}` : null}
            </SummaryRow>
          ) : null}
          {isBusiness && client.contact_email ? (
            <SummaryRow term="Contact email">{client.contact_email}</SummaryRow>
          ) : null}
          {isBusiness && client.contact_phone ? (
            <SummaryRow term="Contact phone">{client.contact_phone}</SummaryRow>
          ) : null}
        </SummaryList>
      </SummaryPanel>
    );
  };
}
