import { css } from 'remix/component';

import { colors, fontFamily, focus, radius } from './theme.ts';

/**
 * The shared surface of text-entry controls: one declaration of the box, focus, and
 * invalid treatment `Input` and `Select` render, so the two elements cannot drift.
 */
export const controlSurfaceStyle = css({
  padding: '10px 12px',
  width: '100%',
  minHeight: '48px',
  boxSizing: 'border-box',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily,
  fontSize: 'max(1rem, 1em)',
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
    borderColor: colors.accent,
  },
  // One owner for `border`: the invalid state is a variant, not a second style.
  '&[data-variant="error"]': { borderColor: colors.danger },
});
