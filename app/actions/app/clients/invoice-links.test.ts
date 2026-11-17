import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { db, invoices } from '../../../data/db.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, origin } from '../../../../test/http.ts';

async function seedInvoice(
  organizationId: string,
  clientId: string,
  id: string,
  recipientName: string,
): Promise<void> {
  await db.create(invoices, {
    id,
    organization_id: organizationId,
    client_id: clientId,
    document_type: 'invoice',
    status: 'draft',
    invoice_number: null,
    currency: 'INR',
    invoice_date: '2026-10-01',
    due_date: '2026-10-01',
    payment_term: 'due_on_receipt',
    custom_payment_terms: null,
    recipient_legal_name: recipientName,
    recipient_billing_line1: null,
    recipient_billing_locality: null,
    recipient_billing_region: null,
    recipient_billing_postal_code: null,
    recipient_billing_country: null,
    recipient_tax_country: null,
    recipient_tax_type: null,
    recipient_tax_value: null,
    recipient_tax_state_name: null,
    recipient_tax_state_code: null,
    payment_instructions: null,
    customer_notes: null,
    internal_note: null,
    subtotal_minor: 1000,
    line_discount_total_minor: 0,
    invoice_discount_mode: null,
    invoice_discount_value: null,
    invoice_discount_minor: 0,
    net_subtotal_minor: 1000,
    round_off_minor: 0,
    total_minor: 1000,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
}

describe('Client invoice links', () => {
  it('links Active and Archived Clients to only their Organization-scoped invoices', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'client-invoice-owner');
    let other = await createUserAndLoginWithOrganization(router, 'client-invoice-other');
    let activeClient = await createClient(owner.organizationId, {
      type: 'individual',
      legal_name: `Active Invoice Client ${crypto.randomUUID()}`,
    });
    let archivedClient = await createClient(owner.organizationId, {
      type: 'business',
      legal_name: `Archived Invoice Client ${crypto.randomUUID()}`,
      status: 'archived',
      archived_at: Date.now(),
    });
    let anotherClient = await createClient(owner.organizationId, {
      type: 'individual',
      legal_name: `Another Invoice Client ${crypto.randomUUID()}`,
    });
    let foreignClient = await createClient(other.organizationId, {
      type: 'individual',
      legal_name: `Foreign Invoice Client ${crypto.randomUUID()}`,
    });

    await seedInvoice(owner.organizationId, activeClient.id, 'active-client-invoice', 'Active invoice');
    await seedInvoice(
      owner.organizationId,
      archivedClient.id,
      'archived-client-invoice',
      'Archived invoice',
    );
    await seedInvoice(
      owner.organizationId,
      anotherClient.id,
      'another-client-invoice',
      'Another Client invoice',
    );
    await seedInvoice(
      other.organizationId,
      foreignClient.id,
      'foreign-client-invoice',
      'Foreign Organization invoice',
    );

    let activeProfile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: activeClient.id }),
      owner.sessionCookie,
    );
    let archivedProfile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: archivedClient.id }),
      owner.sessionCookie,
    );
    let activeDirectoryHref = routes.app.invoices.index.href(
      {},
      { searchParams: { clientId: activeClient.id } },
    );
    let archivedDirectoryHref = routes.app.invoices.index.href(
      {},
      { searchParams: { clientId: archivedClient.id } },
    );
    let activeNewDraftHref = routes.app.invoices.new.index.href(
      {},
      { searchParams: { clientId: activeClient.id } },
    );

    assert.ok(activeProfile.includes(`href="${activeDirectoryHref}"`));
    assert.ok(activeProfile.includes(`href="${activeNewDraftHref}"`));
    assert.match(activeProfile, />1 invoice</);
    assert.ok(archivedProfile.includes(`href="${archivedDirectoryHref}"`));
    assert.ok(
      !archivedProfile.includes(
        `href="${routes.app.invoices.new.index.href({}, { searchParams: { clientId: archivedClient.id } })}"`,
      ),
      'Archived Clients cannot start a new Draft from their profile',
    );
    assert.match(archivedProfile, />1 invoice</);

    let activeDraftPage = await getHtml(router, activeNewDraftHref, owner.sessionCookie);
    assert.match(activeDraftPage, new RegExp(`name="client_id"[^>]*value="${activeClient.id}"`));

    let activeInvoices = await getHtml(router, activeDirectoryHref, owner.sessionCookie);
    assert.match(activeInvoices, /Active invoice/);
    assert.doesNotMatch(activeInvoices, /Archived invoice|Another Client invoice|Foreign Organization invoice/);

    let archivedInvoices = await getHtml(router, archivedDirectoryHref, owner.sessionCookie);
    assert.match(archivedInvoices, /Archived invoice/);
    assert.doesNotMatch(archivedInvoices, /Active invoice|Another Client invoice|Foreign Organization invoice/);

    let foreignScopedSearch = await getHtml(router, activeDirectoryHref, other.sessionCookie);
    assert.doesNotMatch(foreignScopedSearch, /Active invoice|Foreign Organization invoice/);

    let foreignProfile = await router.fetch(
      new URL(routes.app.clients.show.href({ clientId: foreignClient.id }), origin),
      { headers: { Cookie: owner.sessionCookie } },
    );
    assert.equal(foreignProfile.status, 404);
  });
});
