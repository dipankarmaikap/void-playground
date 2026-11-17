import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { formatMoney } from '../../../data/invoice-calculation.ts';
import { DRAFT_STATUS_LABEL } from '../../../data/invoices.ts';
import type { InvoiceDirectoryItem } from '../../../data/invoices.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { linkButtonStyle } from '../../../ui/button.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../ui/page-styles.ts';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface InvoicesIndexPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  invoices: InvoiceDirectoryItem[];
  message?: string;
}

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
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
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '1rem 1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
  color: colors.text,
  textDecoration: 'none',
  '&:hover': { background: colors.accentSoft },
});

const itemHeadingStyle = css({
  fontSize: '1rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
});

const itemMetaStyle = css({
  color: colors.muted,
  fontSize: '0.8125rem',
});

const emptyStyle = css({
  display: 'grid',
  gap: '0.375rem',
  justifyItems: 'start',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  fontSize: '0.9375rem',
});

export function InvoicesIndexPage(handle: Handle<InvoicesIndexPageProps>) {
  return () => {
    let { csrfToken, identity, organizationName, invoices, message } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title="Invoices"
        description="Prepare and review your Organization's invoices."
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Invoices</h1>
          <p mix={pageIntroStyle}>
            Create drafts for Active Clients in your Organization. Search, filters, and issuing arrive
            in later releases.
          </p>
        </header>
        {message ? (
          <p role="status" mix={[css({ margin: '0 0 1rem', color: colors.success })]}>
            {message}
          </p>
        ) : null}
        <div mix={toolbarStyle}>
          <a href={routes.app.invoices.new.index.href()} mix={linkButtonStyle}>
            New invoice draft
          </a>
        </div>
        {invoices.length === 0 ? (
          <div mix={emptyStyle}>
            <p>No invoices yet.</p>
            <span mix={itemMetaStyle}>Start a draft for one of your Active Clients.</span>
          </div>
        ) : (
          <ul mix={listStyle}>
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <a
                  href={routes.app.invoices.show.href({ invoiceId: invoice.id })}
                  mix={itemStyle}
                >
                  <span mix={itemHeadingStyle}>{invoice.recipient_legal_name}</span>
                  <span mix={itemMetaStyle}>
                    {DRAFT_STATUS_LABEL} · {invoice.invoice_date} ·{' '}
                    {formatMoney(BigInt(invoice.total_minor), invoice.currency)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </AppShell>
    );
  };
}
