import type { Handle, Props } from 'remix/component';

import { controlSurfaceStyle } from './control-style.ts';

export type InputVariant = 'default' | 'error';

export type InputProps = Props<'input'> & {
  variant?: InputVariant;
  name: string;
};

export function Input(handle: Handle<InputProps>) {
  return () => {
    let { variant = 'default', ...inputProps } = handle.props;

    return <input {...inputProps} data-variant={variant} mix={controlSurfaceStyle} />;
  };
}
