import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { colors } from './theme.ts';

export interface FieldProps {
  label: string;
  hint?: string;
  children: RemixNode;
  error?: string;
  errorId?: string;
}

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 600,
});

const hintStyle = css({
  color: colors.muted,
  fontSize: '0.8125rem',
  fontWeight: 400,
  lineHeight: 1.4,
});

const errorStyle = css({
  color: colors.danger,
  fontSize: '12px',
  fontWeight: 400,
});

export function Field(handle: Handle<FieldProps>) {
  return () => {
    let { label, hint, children, error, errorId } = handle.props;

    return (
      <label mix={fieldStyle}>
        {label}
        {children}
        {hint ? <span mix={hintStyle}>{hint}</span> : null}
        {error ? (
          <span id={errorId} mix={errorStyle}>
            {error}
          </span>
        ) : null}
      </label>
    );
  };
}
