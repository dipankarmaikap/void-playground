import { css } from 'remix/component';

import { colors, radius } from '../../../../ui/theme.ts';

/**
 * The bordered surface shared by invoice detail and form sections. Roomier
 * sections (the invoice form, credit note drafts) widen the gap through the
 * `data-gap` variants instead of a second style, so the property has one owner.
 */
export const cardStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  // The invoice form's sections.
  '&[data-gap="form"]': { gap: '1rem' },
  // The credit note draft's sections.
  '&[data-gap="draft"]': { gap: '0.875rem' },
});
