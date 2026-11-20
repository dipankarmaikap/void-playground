import { css } from 'remix/component';

import { colors, radius } from '../../../../ui/theme.ts';

/**
 * The bordered surface shared by invoice detail and form sections. Roomier
 * sections (the invoice form, credit note drafts) mix in a wider `gap`.
 */
export const cardStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
});
