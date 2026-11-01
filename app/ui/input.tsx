import type { Handle, Props } from 'remix/component';
import { css } from 'remix/component';

export type InputVariant = 'default' | 'error';

export type InputProps = Props<'input'> & {
  variant?: InputVariant;
  name: string;
};

const baseStyle = css({
  padding: '8px',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #ccc',
  borderRadius: '4px',
  font: 'inherit',
});

const errorStyle = css({
  borderColor: '#b00020',
});

export function Input(handle: Handle<InputProps>) {
  return () => {
    let { variant = 'default', ...inputProps } = handle.props;

    return (
      <input
        {...inputProps}
        mix={variant === 'error' ? [baseStyle, errorStyle] : baseStyle}
      />
    );
  };
}