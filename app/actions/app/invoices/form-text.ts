import type { AnyParams, ContextEntries, RequestContext } from 'remix/router';

/** The request-context surface needed to read submitted form fields. */
type FormRequestContext = RequestContext<AnyParams, ContextEntries> & {
  formData: FormData;
};

/** Reads one submitted field as text, treating non-string values as empty. */
export function formText(context: FormRequestContext, name: string): string {
  let value = context.formData.get(name);
  return typeof value === 'string' ? value : '';
}
