import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { clientDisplayLabel } from '../../../../data/client-names.ts';
import type { Client, Invoice } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import {
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors } from '../../../../ui/theme.ts';
import type { InvoiceFormValues } from '../form-values.ts';
import { InvoiceForm } from '../invoice-form.tsx';

export interface EditInvoicePageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  invoice: Invoice;
  client: Client | null;
  values: InvoiceFormValues;
  issues?: readonly Issue[];
}

const hintStyle = css({ margin: 0, color: colors.muted, fontSize: '0.875rem' });

export function EditInvoicePage(handle: Handle<EditInvoicePageProps>) {
  return () => {
    let { csrfToken, identity, organizationName, invoice, client, values, issues } = handle.props;

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoices"
        title="Edit invoice draft"
        description={`Edit draft for ${invoice.recipient_legal_name}.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Edit invoice draft</h1>
          <p mix={pageIntroStyle}>
            Drafts stay editable until issued. Recipient changes affect this invoice only.
          </p>
        </header>
        <InvoiceForm
          csrfToken={csrfToken}
          action={routes.app.invoices.edit.action.href({ invoiceId: invoice.id })}
          submitLabel="Save draft"
          values={values}
          issues={issues}
        >
          <p mix={hintStyle}>
            Bill to: {client ? clientDisplayLabel(client) : invoice.recipient_legal_name}
          </p>
        </InvoiceForm>
      </AppShell>
    );
  };
}
