import type { Issue } from 'remix/data-schema';

/** The input types a form field descriptor can render. */
export type InputFieldType = 'text' | 'email' | 'password' | 'tel' | 'date' | 'number';

/**
 * The browser-facing presentation constants for one field of a shared form schema. Each form
 * authors its descriptor table next to its schema so the same constants drive server-side parsing
 * and the input attributes a browser renders; validation rules themselves live in the schema.
 */
export interface FormFieldDescriptor {
  /** The control the field renders as; plain inputs default to their `type`. */
  control?: 'input' | 'select' | 'textarea' | 'checkbox' | 'hidden';
  /** The HTML input type; ignored for controls other than `input`. */
  type?: InputFieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
}

/** Controls that are not plain `<input>` elements and so carry no input type. */
type NonInputControl = 'select' | 'textarea' | 'checkbox' | 'hidden';

type DescriptorAttributeKey =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'step'
  | 'autoComplete';

/**
 * The input attributes one field descriptor contributes. The `type` mirrors exactly what
 * {@link formFieldAttributes} emits, so the result can be spread straight into an `<input>`.
 */
export type FormFieldAttributes<D extends FormFieldDescriptor = FormFieldDescriptor> = (
  D extends { control: NonInputControl }
    ? { type?: undefined }
    : { type: D extends { type: infer T } ? (T extends InputFieldType ? T : 'text') : 'text' }
) &
  Pick<D, Extract<keyof D, DescriptorAttributeKey>> & {
    'aria-invalid'?: true;
  };

/**
 * Derives the browser input attributes for one field from its descriptor, marking the field
 * `aria-invalid` when parsing produced an issue for it.
 */
export function formFieldAttributes<D extends FormFieldDescriptor>(
  descriptor: D,
  issue?: Issue,
): FormFieldAttributes<D> {
  let isInput = descriptor.control === undefined || descriptor.control === 'input';
  let attributes: Record<string, unknown> = {};
  if (isInput) attributes.type = descriptor.type ?? 'text';
  if (descriptor.required) attributes.required = true;
  if (descriptor.minLength != null) attributes.minLength = descriptor.minLength;
  if (descriptor.maxLength != null) attributes.maxLength = descriptor.maxLength;
  if (descriptor.min != null) attributes.min = descriptor.min;
  if (descriptor.max != null) attributes.max = descriptor.max;
  if (descriptor.step != null) attributes.step = descriptor.step;
  if (descriptor.autoComplete) attributes.autoComplete = descriptor.autoComplete;
  if (issue) attributes['aria-invalid'] = true;
  return attributes as FormFieldAttributes<D>;
}
