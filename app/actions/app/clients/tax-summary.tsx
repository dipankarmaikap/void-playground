import type { Handle } from 'remix/component';

import { INDIA_COUNTRY_CODE, clientTaxTypeLabel } from '../../../data/client-tax.ts';
import type { Client } from '../../../data/db.ts';
import { SummaryList, SummaryPanel, SummaryRow } from './summary-list.tsx';

export interface ClientTaxSummaryProps {
  client: Client;
}

/** Route-local read-only view of the Client's single optional tax identifier. */
export function ClientTaxSummary(handle: Handle<ClientTaxSummaryProps>) {
  return () => {
    let { client } = handle.props;
    let country = client.tax_country === INDIA_COUNTRY_CODE ? 'India' : client.tax_country;

    return (
      <SummaryPanel
        title="Tax identifier"
        headingId="client-tax-heading"
        subtitle="Recorded for invoice documents."
      >
        <SummaryList>
          <SummaryRow term="Type">{clientTaxTypeLabel(client.tax_type)}</SummaryRow>
          <SummaryRow term="Country">{country}</SummaryRow>
          <SummaryRow term="Value">{client.tax_value}</SummaryRow>
          {client.tax_state_name ? (
            <SummaryRow term="State or UT">
              {client.tax_state_name}
              {client.tax_state_code ? ` (${client.tax_state_code})` : ''}
            </SummaryRow>
          ) : null}
        </SummaryList>
      </SummaryPanel>
    );
  };
}
