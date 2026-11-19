import type { Handle, Props } from 'remix/component';
import { css } from 'remix/component';

import { colors, fontFamily, radius } from './theme.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = Props<'button'> & {
  variant?: ButtonVariant;
};

const buttonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minHeight: '48px',
  padding: '10px 16px',
  border: '1px solid transparent',
  borderRadius: radius.md,
  background: colors.accent,
  color: colors.onPrimary,
  fontFamily,
  fontSize: '0.9375rem',
  fontWeight: 600,
  lineHeight: 1.2,
  cursor: 'pointer',
  '&:hover': {
    background: colors.accentHover,
  },
  '&[data-variant="secondary"]': {
    background: colors.surface,
    color: colors.text,
    borderColor: colors.border,
  },
  '&[data-variant="secondary"]:hover': {
    background: colors.accentSoft,
    borderColor: colors.accent,
  },
  '&[data-variant="danger"]': {
    background: colors.danger,
    color: colors.onPrimary,
  },
  '&[data-variant="danger"]:hover': {
    background: colors.dangerHover,
  },
});

/** Anchor styling that mirrors {@link Button} for link actions. */
export const linkButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minHeight: '48px',
  padding: '10px 16px',
  border: '1px solid transparent',
  borderRadius: radius.md,
  background: colors.accent,
  color: colors.onPrimary,
  fontFamily,
  fontSize: '0.9375rem',
  fontWeight: 600,
  lineHeight: 1.2,
  textDecoration: 'none',
  '&:hover': {
    background: colors.accentHover,
  },
  '&[data-variant="secondary"]': {
    background: colors.surface,
    color: colors.text,
    borderColor: colors.border,
  },
  '&[data-variant="secondary"]:hover': {
    background: colors.accentSoft,
    borderColor: colors.accent,
  },
  '&[data-variant="danger"]': {
    background: colors.danger,
    color: colors.onPrimary,
  },
  '&[data-variant="danger"]:hover': {
    background: colors.dangerHover,
  },
});

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    let { variant = 'primary', ...buttonProps } = handle.props;

    return (
      <button
        {...buttonProps}
        type={buttonProps.type ?? 'submit'}
        data-variant={variant}
        mix={buttonStyle}
      />
    );
  };
}
