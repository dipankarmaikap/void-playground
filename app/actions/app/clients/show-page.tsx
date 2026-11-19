import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { clientDisplayLabel, clientTypeLabel } from '../../../data/client-names.ts';
import type { Client } from '../../../data/db.ts';
import type { ClientProfileFacts } from '../../../data/client-directory-facts.ts';
import { formatMoney } from '../../../data/invoices/calculation.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Avatar } from '../../../ui/avatar.tsx';
import { linkButtonStyle } from '../../../ui/button.tsx';
import { DataTable, amountCellStyle } from '../../../ui/data-table.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { headingStyle } from '../../../ui/page-header.tsx';
import { Panel, PanelBody, PanelFooter, PanelHeader } from '../../../ui/panel.tsx';
import {
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
} from '../../../ui/page-styles.ts';
import { StatCard, statGridStyle } from '../../../ui/stat-card.tsx';
import { StatusPill, invoiceStatusLabel, invoiceStatusTone } from '../../../ui/status-pill.tsx';
import { neutrals, primary } from '../../../ui/theme.ts';
import { ClientBillingSummary } from './billing-summary.tsx';
import { ClientContactSummary } from './contact-summary.tsx';
import { ClientStatusControls } from './sections/status-controls.tsx';
import { SummaryList, SummaryPanel, SummaryRow } from './summary-list.tsx';
import { ClientTaxSummary } from './tax-summary.tsx';

export interface ClientProfilePageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  client: Client;
  facts: ClientProfileFacts;
  invoiceCount: number;
  error?: string;
  message?: string;
}

const pageHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  marginBottom: '1.5rem',
});

const inlineLinkStyle = css({
  display: 'inline-block',
  marginBottom: '12px',
  color: primary.base,
  fontSize: '0.8125rem',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});

const detailHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

const detailMetaStyle = css({
  minWidth: 0,
});

const contextStyle = css({
  margin: '4px 0 8px',
  color: neutrals.muted,
  fontSize: '0.8125rem',
  lineHeight: 1.55,
});

const headerActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem',
});

const contentGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '18px',
  '@media (min-width: 60rem)': {
    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 0.85fr)',
    alignItems: 'start',
  },
});

const summaryColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
});

const invoiceLinkStyle = css({
  color: neutrals.ink,
  fontSize: '0.75rem',
  fontWeight: 700,
  textDecoration: 'none',
  '&:hover': { color: primary.base, textDecoration: 'underline' },
});

const emptyStyle = css({
  display: 'grid',
  gap: '6px',
  padding: '28px 0',
});

const emptyHeadingStyle = css({
  margin: 0,
  color: neutrals.ink,
  fontSize: '0.9375rem',
  fontWeight: 700,
});

const emptyHintStyle = css({
  margin: 0,
  color: neutrals.muted,
  fontSize: '0.8125rem',
});

const footerActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  marginTop: '18px',
});

const backLinkStyle = css({
  color: neutrals.muted,
  fontSize: '0.875rem',
  textDecoration: 'none',
  '&:hover': { color: primary.base, textDecoration: 'underline' },
});

function formatIssuedDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function clientSince(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function ClientProfilePage(handle: Handle<ClientProfilePageProps>) {
  return () => {
    let { csrfToken, identity, organizationName, client, facts, invoiceCount, error, message } =
      handle.props;
    let label = clientDisplayLabel(client);
    let isBusiness = client.type === 'business';
    let archived = client.status === 'archived';
    let since = clientSince(client.created_at);
    let invoiceDirectoryHref = routes.app.invoices.index.href(
      {},
      { searchParams: { clientId: client.id } },
    );
    let newInvoiceHref = routes.app.invoices.new.href(
      {},
      { searchParams: { clientId: client.id } },
    );

    let contextParts: string[] = [];
    if (isBusiness) {
      let tradingName = client.trading_name?.trim();
      let industry = client.industry?.trim();
      if (tradingName) contextParts.push(tradingName);
      if (industry) contextParts.push(industry);
    } else if (client.preferred_name?.trim() && client.preferred_name.trim() !== label) {
      contextParts.push(client.preferred_name.trim());
    }
    let contextLine = `${contextParts.join(' · ')}${contextParts.length > 0 ? ' · ' : ''}Client since ${since}`;

    let rows = facts.invoices.map((invoice) => ({
      key: invoice.id,
      cells: [
        <a href={routes.app.invoices.show.href({ invoiceId: invoice.id })} mix={invoiceLinkStyle}>
          {invoice.invoiceNumber ?? 'Invoice'}
        </a>,
        <span>{formatIssuedDate(invoice.invoiceDate)}</span>,
        <span mix={amountCellStyle}>{formatMoney(BigInt(invoice.totalMinor), invoice.currency)}</span>,
        <StatusPill tone={invoiceStatusTone[invoice.status]}>
          {invoiceStatusLabel[invoice.status]}
        </StatusPill>,
      ] as RemixNode[],
    }));

    let summary: RemixNode[] = [
      <StatCard
        label="Total invoiced"
        value={formatMoney(BigInt(facts.totalInvoicedMinor), facts.currency)}
        icon="↗"
        foot={<span>Since {since}</span>}
      />,
      <StatCard
        label="Outstanding"
        value={formatMoney(BigInt(facts.outstandingBalanceMinor), facts.currency)}
        icon="$"
        tone="coral"
        foot={<span>Across this client's invoices</span>}
      />,
      <StatCard
        label="Invoices paid"
        value={`${facts.paidInvoiceCount} / ${facts.invoiceCount}`}
        icon="✓"
        tone="green"
        foot={<span>Of this client's invoices</span>}
      />,
      <StatCard
        label="Average time to pay"
        value={
          facts.averageCollectionDays === null
            ? '—'
            : `${facts.averageCollectionDays} days`
        }
        icon="◷"
        tone="amber"
        foot={
          <span>
            {facts.averageCollectionDays === null
              ? 'No payment history yet'
              : 'From active payments'}
          </span>
        }
      />,
    ];

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="clients"
        title={label}
        description={`View the ${clientTypeLabel(client.type)} client profile for ${label} in your Organization's client book.`}
      >
        <header mix={pageHeaderStyle}>
          <div>
            <a href={routes.app.clients.index.href()} mix={inlineLinkStyle}>
              <span aria-hidden="true">←</span> All clients
            </a>
            <div mix={detailHeaderStyle}>
              <Avatar name={label} size="lg" />
              <div mix={detailMetaStyle}>
                <h1 mix={headingStyle}>{label}</h1>
                <p mix={contextStyle}>{contextLine}</p>
                <StatusPill tone={archived ? 'draft' : 'paid'}>
                  {archived ? 'Archived client' : 'Active client'}
                </StatusPill>
              </div>
            </div>
          </div>
          <div mix={headerActionsStyle}>
            <a
              href={routes.app.clients.edit.href({ clientId: client.id })}
              mix={linkButtonStyle}
            >
              Edit client
            </a>
            {archived ? null : (
              <a href={newInvoiceHref} data-variant="secondary" mix={linkButtonStyle}>
                New invoice draft
              </a>
            )}
          </div>
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

        <section aria-label={`${label} account summary`} mix={statGridStyle}>
          {summary}
        </section>

        <div mix={contentGridStyle}>
          <Panel labelledBy="client-invoices-heading">
            <PanelHeader
              title="Invoice history"
              headingId="client-invoices-heading"
              subtitle="A record of work billed to this client."
              action={
                <a href={invoiceDirectoryHref} mix={inlineLinkStyle}>
                  All invoices <span aria-hidden="true">→</span>
                </a>
              }
            />
            <PanelBody>
              {facts.invoices.length === 0 ? (
                <div mix={emptyStyle}>
                  <p mix={emptyHeadingStyle}>No invoices</p>
                  <p mix={emptyHintStyle}>Invoices issued to this client will appear here.</p>
                </div>
              ) : (
                <DataTable
                  label={`${label} invoice history`}
                  columns={[
                    { key: 'invoice', label: 'Invoice' },
                    { key: 'issued', label: 'Issued' },
                    { key: 'amount', label: 'Amount', align: 'right' },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={rows}
                />
              )}
            </PanelBody>
            <PanelFooter>
              <span>
                {facts.invoices.length === 0
                  ? 'No invoices yet'
                  : `${invoiceCount} ${invoiceCount === 1 ? 'invoice' : 'invoices'}`}
              </span>
              <a href={invoiceDirectoryHref} mix={inlineLinkStyle}>
                View all invoices <span aria-hidden="true">→</span>
              </a>
            </PanelFooter>
          </Panel>

          <div mix={summaryColumnStyle}>
            <SummaryPanel
              title="Client details"
              headingId="client-identity-heading"
              subtitle="How this client is recorded."
            >
              <SummaryList>
                <SummaryRow term="Type">{clientTypeLabel(client.type)}</SummaryRow>
                <SummaryRow term="Legal name">{client.legal_name}</SummaryRow>
                {!isBusiness && client.preferred_name ? (
                  <SummaryRow term="Preferred name">{client.preferred_name}</SummaryRow>
                ) : null}
                {isBusiness && client.trading_name ? (
                  <SummaryRow term="Trading name">{client.trading_name}</SummaryRow>
                ) : null}
                {isBusiness && client.industry ? (
                  <SummaryRow term="Industry">{client.industry}</SummaryRow>
                ) : null}
                <SummaryRow term="Status">{archived ? 'Archived' : 'Active'}</SummaryRow>
              </SummaryList>
            </SummaryPanel>
            <ClientContactSummary client={client} />
            {client.tax_value ? <ClientTaxSummary client={client} /> : null}
            <ClientBillingSummary client={client} />
          </div>
        </div>

        <div mix={footerActionsStyle}>
          <ClientStatusControls csrfToken={csrfToken} client={client} />
          <a href={routes.app.clients.index.href()} mix={backLinkStyle}>
            Back to clients
          </a>
        </div>
      </AppShell>
    );
  };
}
