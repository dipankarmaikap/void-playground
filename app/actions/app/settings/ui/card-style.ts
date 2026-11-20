import { css } from 'remix/component';

import { colors, radius, shadow } from '../../../../ui/theme.ts';

/** The summary card both settings pages present profile facts in. */
export const settingsCardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

/** A settings card that follows another card in the same column. */
export const settingsCardStackStyle = css({
  marginTop: '1rem',
});

/** The heading of a settings summary card. */
export const settingsCardHeadingStyle = css({
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 700,
});

/** The definition list of terms and details inside a settings card. */
export const settingsCardListStyle = css({
  margin: 0,
  display: 'grid',
  gap: '0.75rem',
});

/** One uppercase term label in a settings card's definition list. */
export const settingsCardTermStyle = css({
  color: colors.muted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
});

/** One value answer in a settings card's definition list. */
export const settingsCardDetailStyle = css({
  margin: '0.125rem 0 0',
  fontSize: '0.9375rem',
  overflowWrap: 'anywhere',
});
