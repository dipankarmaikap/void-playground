import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { db } from '../../../data/db.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { seedInvoice } from '../../../../test/invoice-fixtures.ts';
import { createUserAndLoginWithOrganization, getHtml, origin } from '../../../../test/http.ts';

describe('Client invoice links', () => {
  it('links Active and Archived Clients to only their Organization-scoped invoices', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'client-invoice-owner');
    let other = await createUserAndLoginWithOrganization(router, 'client-invoice-other');
    let activeClient = await createClient(db, owner.organizationId, {
      type: 'individual',
      legal_name: `Active Invoice Client ${crypto.randomUUID()}`,
    });
    let archivedClient = await createClient(db, owner.organizationId, {
      type: 'business',
      legal_name: `Archived Invoice Client ${crypto.randomUUID()}`,
      status: 'archived',
      archived_at: Date.now(),
    });
    let anotherClient = await createClient(db, owner.organizationId, {
      type: 'individual',
      legal_name: `Another Invoice Client ${crypto.randomUUID()}`,
    });
    let foreignClient = await createClient(db, other.organizationId, {
      type: 'individual',
      legal_name: `Foreign Invoice Client ${crypto.randomUUID()}`,
    });

    await seedInvoice(owner.organizationId, activeClient.id, {
      id: 'active-client-invoice',
      recipientName: 'Active invoice',
    });
    await seedInvoice(
      owner.organizationId,
      archivedClient.id,
      {
        id: 'archived-client-invoice',
        recipientName: 'Archived invoice',
      },
    );
    await seedInvoice(
      owner.organizationId,
      anotherClient.id,
      {
        id: 'another-client-invoice',
        recipientName: 'Another Client invoice',
      },
    );
    await seedInvoice(
      other.organizationId,
      foreignClient.id,
      {
        id: 'foreign-client-invoice',
        recipientName: 'Foreign Organization invoice',
      },
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
