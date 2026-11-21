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
import { formatIsoDate } from '../../../data/dates.ts';
import { formatMoney } from '../../../data/invoices/calculation.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Avatar } from '../../../ui/avatar.tsx';
import { linkButtonStyle } from '../../../ui/button.tsx';
import { EmptyState } from './ui/empty-state.tsx';
import { Table } from './ui/table.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { PageHeader } from './ui/page-header.tsx';
import { Panel } from './ui/panel.tsx';
import {
  noticeErrorStyle,
  noticeStatusStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { StatCard, statGridStyle, trendUpStyle } from './ui/stat-card.tsx';
import { Badge, invoiceStatusLabel, invoiceStatusTone } from '../../../ui/badge.tsx';
import { focus, fontStack, neutrals, primary, radii, shadows, softFills } from '../../../ui/theme.ts';

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

/** The reference's `.btn.btn-primary` treatment for the page's Add client action. */
const addClientStyle = css({
  boxShadow: shadows.primary,
  whiteSpace: 'nowrap',
  transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: shadows.primaryHover,
  },
});

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  marginBottom: '15px',
});

/** Reference `.toolbar-search`: a slim labelled search box, icon on the inside. */
const searchLabelStyle = css({
  position: 'relative',
  display: 'block',
  width: 'min(250px, 100%)',
});

const searchIconStyle = css({
  position: 'absolute',
  top: '10px',
  left: '10px',
  width: '15px',
  height: '15px',
  pointerEvents: 'none',
  fill: 'none',
  stroke: neutrals.softMuted,
  strokeWidth: '1.8',
});

const searchInputStyle = css({
  boxSizing: 'border-box',
  width: '100%',
  height: '36px',
  padding: '0 11px 0 33px',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.md,
  background: neutrals.paper,
  color: neutrals.ink,
  fontFamily: fontStack,
  fontSize: '0.875rem',
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
  },
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

const noInvoiceNoteStyle = css({
  color: neutrals.softMuted,
  fontStyle: 'normal',
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
      return (
        <Table.Row key={client.id}>
          <Table.Cell>
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
            </div>
          </Table.Cell>
          <Table.Cell>{clientFacts?.invoiceCount ?? 0}</Table.Cell>
          <Table.AmountCell>
            {formatMoney(BigInt(clientFacts?.outstandingBalanceMinor ?? 0), currency)}
          </Table.AmountCell>
          <Table.Cell>
            {clientFacts?.lastInvoiceDate ? formatIsoDate(clientFacts.lastInvoiceDate) : 'No invoices'}
          </Table.Cell>
          <Table.Cell>
            {status ? (
              <Badge tone={invoiceStatusTone[status]}>
                {invoiceStatusLabel[status]}
              </Badge>
            ) : (
              <span mix={noInvoiceNoteStyle}>No invoices</span>
            )}
          </Table.Cell>
        </Table.Row>
      );
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
            <a
              href={routes.app.clients.new.href()}
              data-size="compact"
              mix={[linkButtonStyle, addClientStyle]}
            >
              <span aria-hidden="true">＋</span> Add client
            </a>
          }
        />

        {error ? (
          <p role="alert" data-spacing="true" mix={noticeErrorStyle}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" data-spacing="true" mix={noticeStatusStyle}>
            {message}
          </p>
        ) : null}

        <section aria-label="Client summary" mix={statGridStyle}>
          {summary}
        </section>

        <Panel labelledBy="client-list-heading">
          <Panel.Header
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
          <Panel.Body>
            <div mix={toolbarStyle}>
              <form
                method="get"
                action={routes.app.clients.index.href()}
                role="search"
                aria-label="Search clients"
              >
                {/*
                  The type, archived-status, and follow-up views have no controls of their
                  own, so a search must carry them forward as hidden inputs.
                */}
                {type !== 'all' ? <input type="hidden" name="type" value={type} /> : null}
                {archived ? <input type="hidden" name="status" value="archived" /> : null}
                {followUp === 'overdue' || followUp === 'current' ? (
                  <input type="hidden" name="followup" value={followUp} />
                ) : null}
                <label mix={searchLabelStyle}>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    mix={searchIconStyle}
                  >
                    <circle cx="10.8" cy="10.8" r="6.8"></circle>
                    <path d="m16 16 4.5 4.5"></path>
                  </svg>
                  <input
                    name="q"
                    type="search"
                    aria-label="Search clients"
                    placeholder="Search by name, email, or phone"
                    defaultValue={query}
                    mix={searchInputStyle}
                  />
                </label>
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
              <EmptyState>
                <EmptyState.Heading>
                  {hasFilters
                    ? 'No clients match your search and filters.'
                    : archived
                      ? 'No archived clients.'
                      : 'No active clients yet.'}
                </EmptyState.Heading>
                <EmptyState.Hint>
                  {hasFilters
                    ? 'Try a different search, change the filters, or reset them.'
                    : archived
                      ? 'Archiving an active client keeps it here so you can restore it later.'
                      : 'Add your first client to get started.'}
                </EmptyState.Hint>
                {hasFilters ? (
                  <a href={routes.app.clients.index.href()} mix={textLinkStyle}>
                    Reset search and filters
                  </a>
                ) : null}
              </EmptyState>
            ) : (
              <Table label="Client directory">
                <Table.Header>
                  <Table.HeadCell>Client</Table.HeadCell>
                  <Table.HeadCell>Invoices</Table.HeadCell>
                  <Table.HeadCell align="right">Outstanding</Table.HeadCell>
                  <Table.HeadCell>Last invoice</Table.HeadCell>
                  <Table.HeadCell>Status</Table.HeadCell>
                </Table.Header>
                <Table.Body>{rows}</Table.Body>
              </Table>
            )}
          </Panel.Body>
          <Panel.Footer>
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
          </Panel.Footer>
        </Panel>
      </AppShell>
    );
  };
}
