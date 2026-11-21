import type { Handle, Props } from 'remix/component';

import { controlSurfaceStyle } from './control-style.ts';

export type SelectVariant = 'default' | 'error';

export type SelectProps = Props<'select'> & {
  variant?: SelectVariant;
  name: string;
};

export function Select(handle: Handle<SelectProps>) {
  return () => {
    let { variant = 'default', ...selectProps } = handle.props;

    return <select {...selectProps} data-variant={variant} mix={controlSurfaceStyle} />;
  };
}
