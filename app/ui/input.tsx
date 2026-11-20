import type { Handle, Props } from 'remix/component';
import { css } from 'remix/component';

import { colors, fontFamily, radius } from './theme.ts';

export type InputVariant = 'default' | 'error';

export type InputProps = Props<'input'> & {
  variant?: InputVariant;
  name: string;
};

const inputStyle = css({
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
    outline: `2px solid ${colors.accent}`,
    outlineOffset: '1px',
    borderColor: colors.accent,
  },
  // One owner for `border`: the invalid state is a variant, not a second style.
  '&[data-variant="error"]': { borderColor: colors.danger },
});

export function Input(handle: Handle<InputProps>) {
  return () => {
    let { variant = 'default', ...inputProps } = handle.props;

    return <input {...inputProps} data-variant={variant} mix={inputStyle} />;
  };
}
