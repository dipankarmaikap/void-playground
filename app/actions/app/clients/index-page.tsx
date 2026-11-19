import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { clientDisplayLabel, clientTypeLabel } from '../../../data/client-names.ts';
import type { ClientStatus } from '../../../data/client-status.ts';
import {
  CLIENT_DIRECTORY_PAGE_SIZE,
  type ClientDirectoryItem,
  type ClientTypeFilter,
} from '../../../data/clients.ts';
import type { ClientDirectoryFacts, ClientFollowUpFilter } from '../../../data/client-directory-facts.ts';
import { formatMoney } from '../../../data/invoices/calculation.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Avatar } from '../../../ui/avatar.tsx';
import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import { DataTable, amountCellStyle } from './ui/data-table.tsx';
import { Field } from '../../../ui/field.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { Input } from '../../../ui/input.tsx';
import { PageHeader } from './ui/page-header.tsx';
import { Panel, PanelBody, PanelFooter, PanelHeader } from './ui/panel.tsx';
import {
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { Select } from '../../../ui/select.tsx';
import { StatCard, statGridStyle, trendUpStyle } from './ui/stat-card.tsx';
import { StatusPill, invoiceStatusLabel, invoiceStatusTone } from './ui/status-pill.tsx';
import { fontStack, neutrals, primary, radii, softFills } from '../../../ui/theme.ts';

export interface ClientsIndexPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  clients: ClientDirectoryItem[];
  query: string;
  type: ClientTypeFilter;
  status: ClientStatus;
  followUp: ClientFollowUpFilter;
  page: number;
  /** Clients matching the applied filters, before pagination. */
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  facts: ClientDirectoryFacts;
  error?: string;
  message?: string;
}

interface DirectoryFilters {
  q: string;
  type: ClientTypeFilter;
  status: ClientStatus;
  followUp?: ClientFollowUpFilter;
  page?: number;
}

/** Builds a directory URL that preserves the current filters while changing one of them. */
function directoryHref({ q, type, status, followUp = 'all', page }: DirectoryFilters): string {
  let searchParams: Record<string, string> = {};
  if (q) searchParams.q = q;
  if (type !== 'all') searchParams.type = type;
  if (status === 'archived') searchParams.status = 'archived';
  if (followUp !== 'all') searchParams.followup = followUp;
  if (page && page > 1) searchParams.page = String(page);

  return Object.keys(searchParams).length === 0
    ? routes.app.clients.index.href()
    : routes.app.clients.index.href({}, { searchParams });
}

const addClientStyle = css({
  minHeight: '38px',
  padding: '0 15px',
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
});

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '15px',
});

const filterFormStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  alignItems: 'end',
  gap: '10px',
  flex: '1 1 320px',
});

const filterActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
});

const submitButtonStyle = css({
  minHeight: '36px',
  padding: '0 12px',
  fontSize: '0.75rem',
});

const filterRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '7px',
});

const pillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  minHeight: '31px',
  padding: '0 11px',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.sm,
  background: neutrals.paper,
  color: neutrals.muted,
  fontFamily: fontStack,
  fontSize: '0.8125rem',
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: softFills.filterPill.border,
    background: softFills.filterPill.background,
    color: primary.base,
  },
  '&[data-active="true"]': {
    borderColor: softFills.filterPill.border,
    background: softFills.filterPill.background,
    color: primary.base,
  },
});

const pillCountStyle = css({
  opacity: 0.75,
  fontSize: '0.6875rem',
});

const statusNavStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.75rem',
  fontWeight: 600,
});

const statusLinkStyle = css({
  color: primary.base,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
  '&[data-active="true"]': { color: neutrals.ink, fontWeight: 700 },
});

const personCellStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
});

const personInfoStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

const personLinkStyle = css({
  color: neutrals.ink,
  fontSize: '0.8125rem',
  fontWeight: 700,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  '&:hover': { color: primary.base, textDecoration: 'underline' },
});

const personMetaStyle = css({
  color: neutrals.softMuted,
  fontSize: '0.75rem',
  overflowWrap: 'anywhere',
});

const quietStyle = css({
  color: neutrals.softMuted,
  fontStyle: 'normal',
});

const emptyStyle = css({
  display: 'grid',
  gap: '6px',
  justifyItems: 'start',
  padding: '28px 19px',
  color: neutrals.muted,
  fontSize: '0.875rem',
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
  fontSize: '0.75rem',
});

const paginationStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
});

const paginationLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '30px',
  minHeight: '28px',
  padding: '0 8px',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.sm,
  background: neutrals.paper,
  color: primary.base,
  fontSize: '0.75rem',
  fontWeight: 700,
  textDecoration: 'none',
  '&:hover': { background: primary.soft },
});

const currentPageStyle = css({
  color: neutrals.ink,
  fontWeight: 700,
});

function formatInvoiceDate(date: string | null): string {
  if (!date) return 'No invoices';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function clientContext(client: ClientDirectoryItem): string {
  let label = clientDisplayLabel(client);
  let details: string[] = [];
  if (client.type === 'business') {
    let tradingName = client.trading_name?.trim();
    let industry = client.industry?.trim();
    if (tradingName && tradingName !== label) details.push(tradingName);
    if (industry) details.push(industry);
  }
  if (client.legal_name && client.legal_name !== label && !details.includes(client.legal_name)) {
    details.push(client.legal_name);
  }
  return details.join(' · ') || clientTypeLabel(client.type);
}

function clientContact(client: ClientDirectoryItem): string {
  return [client.email?.trim(), client.phone?.trim()].filter(Boolean).join(' · ');
}

function pill(
  label: string,
  count: number,
  href: string,
  current: boolean,
  title?: string,
): RemixNode {
  return (
    <a href={href} data-active={current ? 'true' : undefined} title={title} mix={pillStyle}>
      {label} <span mix={pillCountStyle}>{count}</span>
    </a>
  );
}

export function ClientsIndexPage(handle: Handle<ClientsIndexPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      clients,
      query,
      type,
      status,
      followUp,
      page,
      total,
      hasPrevious,
      hasNext,
      facts,
      error,
      message,
    } = handle.props;
    let archived = status === 'archived';
    let hasFilters = query !== '' || type !== 'all' || followUp !== 'all';
    let currency = facts.summary.currency;

    let activeHref = directoryHref({ q: query, type, status: 'active' });
    let archivedHref = directoryHref({ q: query, type, status: 'archived' });
    let allHref = directoryHref({ q: query, type, status: 'active', followUp: 'all' });
    let currentHref = directoryHref({ q: query, type, status: 'active', followUp: 'current' });
    let followUpHref = directoryHref({ q: query, type, status: 'active', followUp: 'overdue' });
    let previousHref = directoryHref({ q: query, type, status, followUp, page: page - 1 });
    let nextHref = directoryHref({ q: query, type, status, followUp, page: page + 1 });

    let overdueCount = 0;
    for (let clientFacts of facts.clients.values()) {
      if (clientFacts.lifecycleStatus === 'active' && clientFacts.hasOverdueInvoice) {
        overdueCount += 1;
      }
    }
    let currentCount = Math.max(0, facts.summary.activeClientCount - overdueCount);

    let summary: RemixNode[] = [
      <StatCard
        label="Active clients"
        value={String(facts.summary.activeClientCount)}
        icon="♙"
        foot={
          <span mix={trendUpStyle}>
            +{facts.summary.newClientsThisMonth} added this month
          </span>
        }
      />,
      <StatCard
        label="Open balance"
        value={formatMoney(BigInt(facts.summary.outstandingBalanceMinor), currency)}
        icon="$"
        tone="coral"
        foot={<span>Across outstanding invoices</span>}
      />,
      <StatCard
        label="New this month"
        value={String(facts.summary.newClientsThisMonth)}
        icon="✦"
        tone="green"
        foot={<span>Clients added this month</span>}
      />,
      <StatCard
        label="Average time to pay"
        value={
          facts.summary.averageCollectionDays === null
            ? '—'
            : `${facts.summary.averageCollectionDays} days`
        }
        icon="◷"
        tone="amber"
        foot={
          <span>
            {facts.summary.averageCollectionDays === null
              ? 'No payment history yet'
              : 'From active payments'}
          </span>
        }
      />,
    ];

    let rows = clients.map((client) => {
      let label = clientDisplayLabel(client);
      let contact = clientContact(client);
      let clientFacts = facts.clients.get(client.id);
      let status = clientFacts?.status ?? null;
      return {
        key: client.id,
        cells: [
          <div mix={personCellStyle}>
            <Avatar name={label} />
            <span mix={personInfoStyle}>
              <a
                href={routes.app.clients.show.href({ clientId: client.id })}
                mix={personLinkStyle}
              >
                <strong>{label}</strong>
              </a>
              <span mix={personMetaStyle}>{clientContext(client)}</span>
              {contact ? <span mix={personMetaStyle}>{contact}</span> : null}
            </span>
          </div>,
          <span>{clientFacts?.invoiceCount ?? 0}</span>,
          <span mix={amountCellStyle}>
            {formatMoney(BigInt(clientFacts?.outstandingBalanceMinor ?? 0), currency)}
          </span>,
          <span>{formatInvoiceDate(clientFacts?.lastInvoiceDate ?? null)}</span>,
          status ? (
            <StatusPill tone={invoiceStatusTone[status]}>
              {invoiceStatusLabel[status]}
            </StatusPill>
          ) : (
            <span mix={quietStyle}>No invoices</span>
          ),
        ],
      };
    });

    let firstShown = clients.length === 0 ? 0 : (page - 1) * CLIENT_DIRECTORY_PAGE_SIZE + 1;
    let lastShown = clients.length === 0 ? 0 : firstShown + clients.length - 1;
    let shownText =
      clients.length === 0
        ? 'No clients to show'
        : `Showing ${firstShown}–${lastShown} of ${total} clients`;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="clients"
        title="Clients"
        description="Manage the clients your Organization works with."
      >
        <PageHeader
          eyebrow="Relationships, made easier"
          title="Clients"
          intro={
            archived
              ? 'Archived clients keep their details and can be restored to the active directory.'
              : 'Keep every client, conversation, and payment in one lovely place.'
          }
          action={
            <a href={routes.app.clients.new.href()} mix={[linkButtonStyle, addClientStyle]}>
              <span aria-hidden="true">＋</span> Add client
            </a>
          }
        />

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

        <section aria-label="Client summary" mix={statGridStyle}>
          {summary}
        </section>

        <Panel labelledBy="client-list-heading">
          <PanelHeader
            title="Your clients"
            headingId="client-list-heading"
            subtitle="A quick look at your client list."
            action={
              <nav aria-label="Client status" mix={statusNavStyle}>
                <a
                  href={activeHref}
                  data-active={archived ? undefined : 'true'}
                  mix={statusLinkStyle}
                >
                  Active
                </a>
                <a
                  href={archivedHref}
                  data-active={archived ? 'true' : undefined}
                  mix={statusLinkStyle}
                >
                  Archived
                </a>
              </nav>
            }
          />
          <PanelBody>
            <div mix={toolbarStyle}>
              <form
                method="get"
                action={routes.app.clients.index.href()}
                role="search"
                aria-label="Search and filter clients"
                mix={filterFormStyle}
              >
                <Field label="Search clients" hint="Search names, email, or phone numbers.">
                  <Input name="q" type="search" defaultValue={query} />
                </Field>
                <Field label="Client type">
                  <Select name="type">
                    <option value="all" selected={type === 'all'}>
                      All types
                    </option>
                    <option value="individual" selected={type === 'individual'}>
                      Individual
                    </option>
                    <option value="business" selected={type === 'business'}>
                      Business
                    </option>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select name="status">
                    <option value="active" selected={!archived}>
                      Active
                    </option>
                    <option value="archived" selected={archived}>
                      Archived
                    </option>
                  </Select>
                </Field>
                {followUp === 'overdue' || followUp === 'current' ? (
                  <input type="hidden" name="followup" value={followUp} />
                ) : null}
                <div mix={filterActionsStyle}>
                  <Button type="submit" mix={submitButtonStyle}>
                    Apply filters
                  </Button>
                  <a href={routes.app.clients.index.href()} mix={[textLinkStyle, submitButtonStyle]}>
                    Reset
                  </a>
                </div>
              </form>
              <div
                mix={filterRowStyle}
                role="group"
                aria-label="Filter clients by follow-up"
              >
                {pill('All clients', facts.summary.activeClientCount, allHref, !archived && followUp === 'all')}
                {pill('Active', currentCount, currentHref, !archived && followUp === 'current')}
                {pill(
                  'Needs follow-up',
                  overdueCount,
                  followUpHref,
                  !archived && followUp === 'overdue',
                  'Clients with at least one overdue invoice',
                )}
              </div>
            </div>

            {clients.length === 0 ? (
              <div mix={emptyStyle}>
                <p mix={emptyHeadingStyle}>
                  {hasFilters
                    ? 'No clients match your search and filters.'
                    : archived
                      ? 'No archived clients.'
                      : 'No active clients yet.'}
                </p>
                <p mix={emptyHintStyle}>
                  {hasFilters
                    ? 'Try a different search, change the filters, or reset them.'
                    : archived
                      ? 'Archiving an active client keeps it here so you can restore it later.'
                      : 'Add your first client to get started.'}
                </p>
                {hasFilters ? (
                  <a href={routes.app.clients.index.href()} mix={textLinkStyle}>
                    Reset search and filters
                  </a>
                ) : null}
              </div>
            ) : (
              <DataTable
                label="Client directory"
                columns={[
                  { key: 'client', label: 'Client' },
                  { key: 'invoices', label: 'Invoices' },
                  { key: 'outstanding', label: 'Outstanding', align: 'right' },
                  { key: 'last', label: 'Last invoice' },
                  { key: 'status', label: 'Status' },
                ]}
                rows={rows}
              />
            )}
          </PanelBody>
          <PanelFooter>
            <span>{shownText}</span>
            {hasPrevious || hasNext ? (
              <nav aria-label="Client list pages" mix={paginationStyle}>
                {hasPrevious ? (
                  <a href={previousHref} mix={paginationLinkStyle}>
                    Previous
                  </a>
                ) : null}
                <span aria-current="page" mix={currentPageStyle}>
                  {page}
                </span>
                {hasNext ? (
                  <a href={nextHref} mix={paginationLinkStyle}>
                    Next
                  </a>
                ) : null}
              </nav>
            ) : null}
          </PanelFooter>
        </Panel>
      </AppShell>
    );
  };
}
