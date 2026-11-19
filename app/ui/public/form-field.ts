import type { Issue } from 'remix/data-schema';

/**
 * The browser-facing presentation constants for one field of a shared form schema. Each form
 * authors its descriptor table next to its schema so the same constants drive server-side parsing
 * and the input attributes a browser renders; validation rules themselves live in the schema.
 */
export interface FormFieldDescriptor {
  /** The control the field renders as; plain inputs default to their `type`. */
  control?: 'input' | 'select' | 'textarea' | 'checkbox' | 'hidden';
  /** The HTML input type; ignored for controls other than `input`. */
  type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'number';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
  list?: string;
}

/** The input attributes one schema field contributes, shared by server render and browser use. */
export interface FormFieldAttributes {
  type?: FormFieldDescriptor['type'];
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
  list?: string;
  'aria-invalid'?: true;
}

/**
 * Derives the browser input attributes for one field from its descriptor, marking the field
 * `aria-invalid` when parsing produced an issue for it.
 */
export function formFieldAttributes(
  descriptor: FormFieldDescriptor,
  issue?: Issue,
): FormFieldAttributes {
  let isInput = descriptor.control === undefined || descriptor.control === 'input';
  let attributes: FormFieldAttributes = {};
  if (isInput) attributes.type = descriptor.type ?? 'text';
  if (descriptor.required) attributes.required = true;
  if (descriptor.minLength != null) attributes.minLength = descriptor.minLength;
  if (descriptor.maxLength != null) attributes.maxLength = descriptor.maxLength;
  if (descriptor.min != null) attributes.min = descriptor.min;
  if (descriptor.max != null) attributes.max = descriptor.max;
  if (descriptor.step != null) attributes.step = descriptor.step;
  if (descriptor.autoComplete) attributes.autoComplete = descriptor.autoComplete;
  if (descriptor.list) attributes.list = descriptor.list;
  if (issue) attributes['aria-invalid'] = true;
  return attributes;
}
