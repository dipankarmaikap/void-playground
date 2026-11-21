import { css } from 'remix/component';

import { colors, radius } from '../../../../ui/theme.ts';

/** The free-text note area shared by the invoice show page and the credit note draft. */
export const invoiceNoteAreaStyle = css({
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '7rem',
  padding: '0.75rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: 'max(1rem, 1em)',
});
