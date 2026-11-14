import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { colors } from './theme.ts';

export interface FieldProps {
  label: string;
  children: RemixNode;
  error?: string;
}

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 600,
});

const errorStyle = css({
  color: colors.danger,
  fontSize: '12px',
  fontWeight: 400,
});

export function Field(handle: Handle<FieldProps>) {
  return () => {
    let { label, children, error } = handle.props;

    return (
      <label mix={fieldStyle}>
        {label}
        {children}
        {error ? <span mix={errorStyle}>{error}</span> : null}
      </label>
    );
  };
}
