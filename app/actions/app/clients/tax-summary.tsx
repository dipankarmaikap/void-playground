import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { INDIA_COUNTRY_CODE, clientTaxTypeLabel } from '../../../data/client-tax.ts';
import type { Client } from '../../../data/db.ts';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface ClientTaxSummaryProps {
  client: Client;
}

const cardStyle = css({
  marginTop: '1.25rem',
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

/** Route-local read-only view of the Client's single optional tax identifier. */
export function ClientTaxSummary(handle: Handle<ClientTaxSummaryProps>) {
  return () => {
    let { client } = handle.props;
    let country =
      client.tax_country === INDIA_COUNTRY_CODE ? 'India' : client.tax_country;

    return (
      <section aria-labelledby="client-tax-heading" mix={cardStyle}>
        <h2 id="client-tax-heading" mix={cardHeadingStyle}>
          Tax identifier
        </h2>
        <dl mix={listStyle}>
          <div>
            <dt mix={termStyle}>Type</dt>
            <dd mix={detailStyle}>{clientTaxTypeLabel(client.tax_type)}</dd>
          </div>
          <div>
            <dt mix={termStyle}>Country</dt>
            <dd mix={detailStyle}>{country}</dd>
          </div>
          <div>
            <dt mix={termStyle}>Value</dt>
            <dd mix={detailStyle}>{client.tax_value}</dd>
          </div>
          {client.tax_state_name ? (
            <div>
              <dt mix={termStyle}>State or UT</dt>
              <dd mix={detailStyle}>
                {client.tax_state_name}
                {client.tax_state_code ? ` (${client.tax_state_code})` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    );
  };
}
