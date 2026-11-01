import type { Handle } from 'remix/component';
import { css } from 'remix/component';

export type InputVariant = 'default' | 'error';

export interface InputProps {
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
  disabled?: boolean;
  readOnly?: boolean;
  variant?: InputVariant;
}

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
    let {
      name,
      type = 'text',
      defaultValue,
      required,
      minLength,
      maxLength,
      placeholder,
      autoComplete,
      id,
      disabled,
      readOnly,
      variant = 'default',
    } = handle.props;

    return (
      <input
        id={id}
        name={name}
        type={type as any}
        defaultValue={defaultValue}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        readOnly={readOnly}
        mix={variant === 'error' ? [baseStyle, errorStyle] : baseStyle}
      />
    );
  };
}