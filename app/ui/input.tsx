import type { Handle, Props } from 'remix/component';
import { css } from 'remix/component';

import { colors, fontFamily, radius } from './theme.ts';

export type InputVariant = 'default' | 'error';

export type InputProps = Props<'input'> & {
  variant?: InputVariant;
  name: string;
};

const baseStyle = css({
  padding: '10px 12px',
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily,
  fontSize: '0.9375rem',
  '&:focus': {
    outline: `2px solid ${colors.accent}`,
    outlineOffset: '1px',
    borderColor: colors.accent,
  },
});

const errorStyle = css({
  borderColor: colors.danger,
});

export function Input(handle: Handle<InputProps>) {
  return () => {
    let { variant = 'default', ...inputProps } = handle.props;

    return (
      <input {...inputProps} mix={variant === 'error' ? [baseStyle, errorStyle] : baseStyle} />
    );
  };
}
