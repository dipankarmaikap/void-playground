import type { Handle } from 'remix/component';

import {
  billingAddressLines,
  currencyName,
  hasBillingAddress,
  hasBillingDetails,
} from '../../../data/client-billing.ts';
import type { Client } from '../../../data/db.ts';
import { SummaryEmpty, SummaryList, SummaryPanel, SummaryRow } from './summary-list.tsx';

export interface ClientBillingSummaryProps {
  client: Client;
}

/** Route-local read-only summary of a Client's optional billing address and currency. */
export function ClientBillingSummary(handle: Handle<ClientBillingSummaryProps>) {
  return () => {
    let { client } = handle.props;

    if (!hasBillingDetails(client)) {
      return (
        <SummaryPanel title="Billing" headingId="client-billing-heading" subtitle="Invoice defaults.">
          <SummaryEmpty>No billing details recorded.</SummaryEmpty>
        </SummaryPanel>
      );
    }

    let addressLines = hasBillingAddress(client) ? billingAddressLines(client) : [];
    let currency = client.billing_currency;
    let currencyLabel = currency ? currencyName(currency) : null;

    return (
      <SummaryPanel title="Billing" headingId="client-billing-heading" subtitle="Invoice defaults.">
        <SummaryList>
          {addressLines.length > 0 ? (
            <SummaryRow term="Billing address">
              {addressLines.map((line, index) => (
                <span key={`${index}-${line}`}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </SummaryRow>
          ) : null}
          {currency ? (
            <SummaryRow term="Default currency">
              {currency}
              {currencyLabel ? ` — ${currencyLabel}` : null}
            </SummaryRow>
          ) : null}
        </SummaryList>
      </SummaryPanel>
    );
  };
}
