import { css } from 'remix/component';

import { colors, radius } from './theme.ts';

/** Page header used by standalone auth cards. */
export const authHeaderStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
});

export const authHeadingStyle = css({
  margin: 0,
  fontSize: '1.5rem',
  lineHeight: 1.2,
});

export const authIntroStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.9375rem',
  lineHeight: 1.5,
});

/** Page header used inside the authenticated app shell. */
export const pageHeaderStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.5rem',
});

export const pageHeadingStyle = css({
  margin: 0,
  fontSize: '1.75rem',
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
});

export const pageIntroStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
});

export const noticeErrorStyle = css({
  margin: 0,
  padding: '10px 12px',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.sm,
  background: colors.dangerSoft,
  color: colors.danger,
  fontSize: '0.875rem',
});

export const noticeStatusStyle = css({
  margin: 0,
  padding: '10px 12px',
  border: `1px solid ${colors.success}`,
  borderRadius: radius.sm,
  background: colors.successSoft,
  color: colors.success,
  fontSize: '0.875rem',
});

/** Separates a notice from the content that follows it inside the app shell. */
export const noticeSpacingStyle = css({
  margin: '0 0 1rem',
});

export const formStackStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export const formStackStartStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  alignItems: 'flex-start',
});

export const pageFooterStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.875rem',
});

export const textLinkStyle = css({
  color: colors.accent,
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': {
    color: colors.accentHover,
    textDecoration: 'underline',
  },
});
