import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

export interface FieldProps {
  label: string;
  children: RemixNode;
  error?: string;
}

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

const errorStyle = css({
  color: '#b00020',
  fontSize: '12px',
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