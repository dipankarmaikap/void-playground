import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../../../config.ts';
import { clientDisplayLabel, clientTypeLabel } from '../../../data/client-names.ts';
import type { ClientStatus } from '../../../data/client-status.ts';
import type { ClientDirectoryItem, ClientTypeFilter } from '../../../data/clients.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { Input } from '../../../ui/input.tsx';
import {
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { Select } from '../../../ui/select.tsx';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface ClientsIndexPageProps {
  csrfToken: string;
  identity: UserIdentity;
  clients: ClientDirectoryItem[];
  query: string;
  type: ClientTypeFilter;
  status: ClientStatus;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  error?: string;
  message?: string;
}

interface DirectoryFilters {
  q: string;
  type: ClientTypeFilter;
  status: ClientStatus;
  page?: number;
}

/** Builds a directory URL that keeps the current search and type while switching status. */
function directoryHref({ q, type, status, page }: DirectoryFilters): string {
  let searchParams: Record<string, string> = {};
  if (q) searchParams.q = q;
  if (type !== 'all') searchParams.type = type;
  if (status === 'archived') searchParams.status = 'archived';
  if (page && page > 1) searchParams.page = String(page);

  return Object.keys(searchParams).length === 0
    ? routes.app.clients.index.href()
    : routes.app.clients.index.href({}, { searchParams });
}

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginBottom: '1.25rem',
});

const filterFormStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
  alignItems: 'end',
  gap: '0.75rem',
  marginBottom: '1.25rem',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
});

const filterActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
});

const statusNavStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
});

const paginationStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  marginTop: '1.5rem',
});

const pageNumberStyle = css({
  color: colors.muted,
  fontSize: '0.875rem',
  fontWeight: 600,
});

const statusLinkStyle = css({
  padding: '0.5rem 0.875rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': {
    background: colors.accentSoft,
    borderColor: colors.accent,
  },
  '&[data-active="true"]': {
    background: colors.accentSoft,
    borderColor: colors.accent,
    color: colors.accent,
  },
});

const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.75rem',
});

const itemStyle = css({
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const itemLinkStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '1rem 1.25rem',
  color: colors.text,
  textDecoration: 'none',
  '&:hover': {
    background: colors.accentSoft,
  },
});

const nameStyle = css({
  fontSize: '1rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
});

const metaStyle = css({
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

const emptyHeadingStyle = css({
  margin: 0,
  color: colors.text,
  fontWeight: 600,
});

const emptyHintStyle = css({
  margin: 0,
  color: colors.muted,
});

export function ClientsIndexPage(handle: Handle<ClientsIndexPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      clients,
      query,
      type,
      status,
      page,
      hasPrevious,
      hasNext,
      error,
      message,
    } = handle.props;
    let archived = status === 'archived';
    let hasFilters = query !== '' || type !== 'all';
    let activeHref = directoryHref({ q: query, type, status: 'active' });
    let archivedHref = directoryHref({ q: query, type, status: 'archived' });
    let previousHref = directoryHref({ q: query, type, status, page: page - 1 });
    let nextHref = directoryHref({ q: query, type, status, page: page + 1 });

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        section="clients"
        title="Clients"
        description={`Manage the people and businesses in the shared ${APP_NAME} client book.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Clients</h1>
          <p mix={pageIntroStyle}>
            {archived
              ? 'Archived clients keep their details and can be restored to the active directory.'
              : 'Manage the people and businesses your Organization works with.'}
          </p>
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
        <div mix={toolbarStyle}>
          <a href={routes.app.clients.new.index.href()} mix={linkButtonStyle}>
            New client
          </a>
          <nav aria-label="Client status" mix={statusNavStyle}>
            <a
              href={activeHref}
              data-active={archived ? undefined : 'true'}
              aria-current={archived ? undefined : 'page'}
              mix={statusLinkStyle}
            >
              Active
            </a>
            <a
              href={archivedHref}
              data-active={archived ? 'true' : undefined}
              aria-current={archived ? 'page' : undefined}
              mix={statusLinkStyle}
            >
              Archived
            </a>
          </nav>
        </div>
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
          <div mix={filterActionsStyle}>
            <Button type="submit">Apply filters</Button>
            <a
              href={routes.app.clients.index.href()}
              data-variant="secondary"
              mix={linkButtonStyle}
            >
              Reset
            </a>
          </div>
        </form>
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
          <ul mix={listStyle}>
            {clients.map((client) => {
              let label = clientDisplayLabel(client);
              return (
                <li key={client.id} mix={itemStyle}>
                  <a
                    href={routes.app.clients.show.href({ clientId: client.id })}
                    mix={itemLinkStyle}
                  >
                    <span mix={nameStyle}>{label}</span>
                    <span mix={metaStyle}>{clientTypeLabel(client.type)}</span>
                    {label === client.legal_name ? null : (
                      <span mix={metaStyle}>{client.legal_name}</span>
                    )}
                    {client.email ? <span mix={metaStyle}>{client.email}</span> : null}
                    {client.phone ? <span mix={metaStyle}>{client.phone}</span> : null}
                    {client.type === 'business' && client.industry ? (
                      <span mix={metaStyle}>{client.industry}</span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {hasPrevious || hasNext ? (
          <nav aria-label="Client pages" mix={paginationStyle}>
            {hasPrevious ? (
              <a href={previousHref} data-variant="secondary" mix={linkButtonStyle}>
                Previous
              </a>
            ) : null}
            <span aria-current="page" mix={pageNumberStyle}>
              Page {page}
            </span>
            {hasNext ? <a href={nextHref} mix={linkButtonStyle}>Next</a> : null}
          </nav>
        ) : null}
      </AppShell>
    );
  };
}
