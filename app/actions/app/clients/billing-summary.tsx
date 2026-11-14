import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import {
  billingAddressLines,
  currencyName,
  hasBillingAddress,
  hasBillingDetails,
} from '../../../data/client-billing.ts';
import type { Client } from '../../../data/db.ts';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface ClientBillingSummaryProps {
  client: Client;
}

const cardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
  marginTop: '1rem',
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

const emptyStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.9375rem',
});

/** Route-local read-only summary of a Client's optional billing address and currency. */
export function ClientBillingSummary(handle: Handle<ClientBillingSummaryProps>) {
  return () => {
    let { client } = handle.props;

    if (!hasBillingDetails(client)) {
      return (
        <section aria-labelledby="client-billing-heading" mix={cardStyle}>
          <h2 id="client-billing-heading" mix={cardHeadingStyle}>
            Billing
          </h2>
          <p mix={emptyStyle}>No billing details recorded.</p>
        </section>
      );
    }

    let addressLines = hasBillingAddress(client) ? billingAddressLines(client) : [];
    let currency = client.billing_currency;
    let currencyLabel = currency ? currencyName(currency) : null;

    return (
      <section aria-labelledby="client-billing-heading" mix={cardStyle}>
        <h2 id="client-billing-heading" mix={cardHeadingStyle}>
          Billing
        </h2>
        <dl mix={listStyle}>
          {addressLines.length > 0 ? (
            <div>
              <dt mix={termStyle}>Billing address</dt>
              <dd mix={detailStyle}>
                {addressLines.map((line, index) => (
                  <span key={`${index}-${line}`}>
                    {index > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {currency ? (
            <div>
              <dt mix={termStyle}>Default currency</dt>
              <dd mix={detailStyle}>
                {currency}
                {currencyLabel ? ` — ${currencyLabel}` : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    );
  };
}
