import type { Issue } from 'remix/data-schema';

import type { Client } from '../../../data/db.ts';
import { clientFormSections } from './sections/registry.ts';
import type { ClientFormSectionContext } from './sections/registry.ts';

export interface ParsedClientForm {
  changes: Partial<Client>;
  issues: Issue[];
  warning?: string;
}

/** Parses every registered Client form section and combines its changes and feedback. */
export async function parseClientForm(
  formData: FormData,
  context: ClientFormSectionContext,
): Promise<ParsedClientForm> {
  let results = await Promise.all(
    clientFormSections.map((section) => section.parse(formData, context)),
  );

  return {
    changes: Object.assign({}, ...results.map((result) => result.changes)),
    issues: results.flatMap((result) => result.issues),
    warning: results.find((result) => result.warning)?.warning,
  };
}
