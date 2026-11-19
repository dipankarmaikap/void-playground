import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import type { InvoiceDisplayStatus } from '../data/invoices/issuance.ts';
import { fontStack, radii, statusColors } from './theme.ts';

/** Semantic tone of a status pill, named after the reference stylesheet's status classes. */
export type StatusTone = keyof typeof statusColors;

/** Maps the domain's derived Invoice display statuses onto the reference's pill tones. */
export const invoiceStatusTone: Record<InvoiceDisplayStatus, StatusTone> = {
  paid: 'paid',
  sent: 'sent',
  partially_paid: 'pending',
  overdue: 'overdue',
  draft: 'draft',
  cancelled: 'draft',
};

/** Human-readable labels for the derived Invoice display statuses. */
export const invoiceStatusLabel: Record<InvoiceDisplayStatus, string> = {
  paid: 'Paid',
  sent: 'Invoice sent',
  partially_paid: 'Partially paid',
  overdue: 'Past due',
  draft: 'Draft',
  cancelled: 'Cancelled',
};

export const statusPillBaseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 9px',
  borderRadius: radii.md,
  fontFamily: fontStack,
  fontSize: '0.8125rem',
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  '&::before': {
    content: '""',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'currentColor',
  },
});

const toneStyles = {
  paid: css({ background: statusColors.paid.background, color: statusColors.paid.color }),
  sent: css({ background: statusColors.sent.background, color: statusColors.sent.color }),
  draft: css({ background: statusColors.draft.background, color: statusColors.draft.color }),
  overdue: css({ background: statusColors.overdue.background, color: statusColors.overdue.color }),
  pending: css({ background: statusColors.pending.background, color: statusColors.pending.color }),
};

export interface StatusPillProps {
  tone: StatusTone;
  children: RemixNode;
}

/** A compact, readable status indicator; all meaning is also present as text. */
export function StatusPill(handle: Handle<StatusPillProps>) {
  return () => {
    let { tone, children } = handle.props;
    return <span mix={[statusPillBaseStyle, toneStyles[tone]]}>{children}</span>;
  };
}
