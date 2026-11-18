import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { formatMoney } from '../../../data/invoices/calculation.ts';
import { DRAFT_STATUS_LABEL } from '../../../data/invoices/records.ts';
import type { InvoiceDirectoryItem } from '../../../data/invoices/records.ts';
import { routes } from '../../../routes.ts';
import { AppShell } from '../../../ui/app-shell.tsx';
import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import type { UserIdentity } from '../../../ui/identity.ts';
import { Input } from '../../../ui/input.tsx';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../ui/page-styles.ts';
import { Select } from '../../../ui/select.tsx';
import { colors, radius, shadow } from '../../../ui/theme.ts';

export interface InvoicesIndexPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  invoices: InvoiceDirectoryItem[];
  clientId: string;
  clientName?: string;
  query: string;
  status: string;
  from: string;
  to: string;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  message?: string;
}

interface DirectoryFilters {
  clientId: string;
  query: string;
  status: string;
  from: string;
  to: string;
  page?: number;
}

function directoryHref({ clientId, query, status, from, to, page }: DirectoryFilters): string {
  let searchParams: Record<string, string> = {};
  if (clientId) searchParams.clientId = clientId;
  if (query) searchParams.q = query;
  if (status !== 'all') searchParams.status = status;
  if (from) searchParams.from = from;
  if (to) searchParams.to = to;
  if (page && page > 1) searchParams.page = String(page);

  return Object.keys(searchParams).length === 0
    ? routes.app.invoices.index.href()
    : routes.app.invoices.index.href({}, { searchParams });
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

function statusLabel(status: string): string {
  return status
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function InvoicesIndexPage(handle: Handle<InvoicesIndexPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      invoices,
      clientId,
      clientName,
      query,
      status,
      from,
      to,
      page,
      hasPrevious,
      hasNext,
      message,
    } = handle.props;
    let hasFilters =
      clientId !== '' || query !== '' || status !== 'all' || from !== '' || to !== '';
    let filters = { clientId, query, status, from, to };
    let previousHref = directoryHref({ ...filters, page: page - 1 });
    let nextHref = directoryHref({ ...filters, page: page + 1 });

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
            {clientName
              ? `Invoices for ${clientName}.`
              : 'Browse invoices prepared for Active Clients in your Organization.'}
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
        <search>
          <form
            method="get"
            action={routes.app.invoices.index.href()}
            aria-label="Search and filter invoices"
            mix={filterFormStyle}
          >
            {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
            <Field label="Search invoices" hint="Search recipient names or invoice numbers.">
              <Input name="q" type="search" defaultValue={query} />
            </Field>
            <Field label="Status">
              <Select name="status">
                <option value="all" selected={status === 'all'}>
                  All statuses
                </option>
                <option value="draft" selected={status === 'draft'}>
                  Draft
                </option>
                <option value="sent" selected={status === 'sent'}>
                  Sent
                </option>
                <option value="partially_paid" selected={status === 'partially_paid'}>
                  Partially Paid
                </option>
                <option value="paid" selected={status === 'paid'}>
                  Paid
                </option>
                <option value="overdue" selected={status === 'overdue'}>
                  Overdue
                </option>
                <option value="cancelled" selected={status === 'cancelled'}>
                  Cancelled
                </option>
                {status !== 'all' &&
                status !== 'draft' &&
                status !== 'sent' &&
                status !== 'partially_paid' &&
                status !== 'paid' &&
                status !== 'overdue' &&
                status !== 'cancelled' ? (
                  <option value={status} selected>
                    {statusLabel(status)}
                  </option>
                ) : null}
              </Select>
            </Field>
            <Field label="Invoice date from">
              <Input name="from" type="date" defaultValue={from} />
            </Field>
            <Field label="Invoice date to">
              <Input name="to" type="date" defaultValue={to} />
            </Field>
            <div mix={filterActionsStyle}>
              <Button type="submit">Apply filters</Button>
              <a
                href={directoryHref({ ...filters, query: '', status: 'all', from: '', to: '' })}
                data-variant="secondary"
                mix={linkButtonStyle}
              >
                Reset
              </a>
            </div>
          </form>
        </search>
        {invoices.length === 0 ? (
          <div mix={emptyStyle}>
            <p>{hasFilters ? 'No invoices match your search and filters.' : 'No invoices yet.'}</p>
            <span mix={itemMetaStyle}>
              {hasFilters
                ? 'Try a different search, change the filters, or reset them.'
                : 'Start a draft for one of your Active Clients.'}
            </span>
          </div>
        ) : (
          <ul mix={listStyle}>
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <a
                  href={routes.app.invoices.show.href({ invoiceId: invoice.id })}
                  mix={itemStyle}
                >
                  <span mix={itemHeadingStyle}>
                    {invoice.invoice_number ? `${invoice.invoice_number} · ` : ''}
                    {invoice.recipient_legal_name}
                  </span>
                  <span mix={itemMetaStyle}>
                    {invoice.status === 'draft' ? DRAFT_STATUS_LABEL : statusLabel(invoice.status)} ·{' '}
                    {invoice.invoice_date} ·{' '}
                    {formatMoney(BigInt(invoice.total_minor), invoice.currency)}
                    {invoice.credited_total_minor > 0
                      ? ` · Credited: ${formatMoney(BigInt(invoice.credited_total_minor), invoice.currency)} · Revised total: ${formatMoney(BigInt(invoice.revised_total_minor), invoice.currency)}`
                      : ''}
                    {invoice.status === 'draft'
                      ? ''
                      : ` · Balance due: ${formatMoney(BigInt(invoice.balance_due_minor), invoice.currency)}`}
                    {invoice.refund_due_minor > 0
                      ? ` · Refund due: ${formatMoney(BigInt(invoice.refund_due_minor), invoice.currency)}`
                      : ''}
                    {invoice.credit_note_numbers.length > 0
                      ? ` · Credit notes: ${invoice.credit_note_numbers.join(', ')}`
                      : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {hasPrevious || hasNext ? (
          <nav aria-label="Invoice pages" mix={paginationStyle}>
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
