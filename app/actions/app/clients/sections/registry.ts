import type { RemixNode } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import type { Client } from '../../../../data/db.ts';
import type { ClientFormValues } from '../form-values.ts';
import { billingSection } from './billing-fields.tsx';
import { profileSection } from './profile-fields.tsx';

export interface ClientFormSectionProps {
  values: ClientFormValues;
  issues: readonly Issue[];
}

export interface ClientFormSectionResult {
  values: Partial<ClientFormValues>;
  changes: Partial<Client>;
  issues: Issue[];
}

/**
 * One editable slice of the Client form.
 *
 * Later Client tickets append an entry instead of rewriting the controllers:
 * each section parses its own form fields and returns only the changes it owns.
 */
export interface ClientFormSection {
  /** Stable identity for rendering and diagnostics. */
  key: string;
  render: (props: ClientFormSectionProps) => RemixNode;
  parse: (formData: FormData) => ClientFormSectionResult;
}

export const clientFormSections: ClientFormSection[] = [profileSection, billingSection];
