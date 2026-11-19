import * as s from 'remix/data-schema';
import type { Issue } from 'remix/data-schema';

import type { Client } from '../../../data/db.ts';
import type { ClientFormValues } from './form-values.ts';
import { emptyClientFormValues } from './form-values.ts';
import { ClientForm } from './public/schema.ts';
import { clientFormSections } from './sections/registry.ts';
import type { ClientFormSectionContext } from './sections/registry.ts';

export interface ParsedClientForm {
  /** The parsed submission, re-rendered unchanged when validation fails. */
  values: ClientFormValues;
  changes: Partial<Client>;
  issues: Issue[];
  warning?: string;
}

/**
 * Parses the Client form once through the shared schema, then validates every registered section
 * against its slice of the parsed values and combines the changes and feedback.
 */
export async function parseClientForm(
  formData: FormData,
  context: ClientFormSectionContext,
): Promise<ParsedClientForm> {
  let parsed = s.parseSafe(ClientForm, formData);

  // A submission the schema cannot read as text cannot be re-rendered as field values; the
  // schema's issues describe it while the empty values keep the form usable.
  if (!parsed.success) {
    return { values: emptyClientFormValues(), changes: {}, issues: [...parsed.issues] };
  }

  let values: ClientFormValues = parsed.value;
  let results = await Promise.all(
    clientFormSections.map((section) => section.parse(values, context)),
  );

  return {
    values,
    changes: Object.assign({}, ...results.map((result) => result.changes)),
    issues: results.flatMap((result) => result.issues),
    warning: results.find((result) => result.warning)?.warning,
  };
}
