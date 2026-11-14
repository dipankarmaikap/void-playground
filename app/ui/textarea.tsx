import type { Handle, Props } from 'remix/component';
import { css } from 'remix/component';

import { colors, fontFamily, radius } from './theme.ts';

export type TextareaVariant = 'default' | 'error';

export type TextareaProps = Props<'textarea'> & {
  variant?: TextareaVariant;
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
  resize: 'vertical',
  '&:focus': {
    outline: `2px solid ${colors.accent}`,
    outlineOffset: '1px',
    borderColor: colors.accent,
  },
});

const errorStyle = css({
  borderColor: colors.danger,
});

export function Textarea(handle: Handle<TextareaProps>) {
  return () => {
    let { variant = 'default', rows = 3, ...textareaProps } = handle.props;

    return (
      <textarea
        {...textareaProps}
        rows={rows}
        mix={variant === 'error' ? [baseStyle, errorStyle] : baseStyle}
      />
    );
  };
}
