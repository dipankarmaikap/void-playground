import * as assert from 'remix/assert';
import { beforeEach, describe, it } from 'remix/test';

import { clients, invoicePayments, invoices } from '../../../data/db.ts';
import type { Client, Invoice } from '../../../data/db.ts';
import { clearTestTables } from '../../../../test/db-setup.ts';
import { createTestRouter } from '../../../../test/router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  submitForm,
} from '../../../../test/http.ts';

const { router, db } = await createTestRouter();

let organizationId: string;

beforeEach(async () => {
  await clearTestTables(db, invoicePayments, invoices, clients);
});

async function seedClient(overrides: Partial<Client> = {}): Promise<Client> {
  let now = Date.now();
  return db.create(
    clients,
    {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: 'individual',
      legal_name: `Directory Client ${crypto.randomUUID()}`,
      status: 'active',
      archived_at: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    },
    { returnRow: true },
  );
}

async function seedInvoice(overrides: Partial<Invoice> = {}): Promise<Invoice> {
  let now = Date.now();
  let total = overrides.total_minor ?? 100_000;
  return db.create(
    invoices,
    {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      client_id: overrides.client_id ?? crypto.randomUUID(),
      document_type: 'invoice',
      status: 'issued',
      invoice_number: `INV/${crypto.randomUUID()}`,
      issued_at: now,
      seller_legal_name: 'Directory Seller',
      seller_address_line1: '1 Directory Street',
      seller_country: 'IN',
      seller_gst_registered: false,
      currency: 'INR',
      invoice_date: '2019-12-01',
      due_date: '2020-01-01',
      payment_term: 'net_30',
      recipient_legal_name: 'Directory Recipient',
      gst_mode: 'none',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: total,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: total,
      tax_total_minor: 0,
      round_off_minor: 0,
      total_minor: total,
      created_at: now,
      updated_at: now,
      ...overrides,
    },
    { returnRow: true },
  );
}

async function seedPayment(invoiceId: string, paymentDate: string, amountMinor: number) {
  let now = Date.now();
  await db.create(invoicePayments, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    invoice_id: invoiceId,
    payment_date: paymentDate,
    amount_minor: amountMinor,
    payment_method: 'bank_transfer',
    reference: null,
    voided_at: null,
    void_reason: null,
    created_at: now,
    updated_at: now,
  });
}

function indexHref(params: Record<string, string> = {}) {
  return Object.keys(params).length === 0
    ? routes.app.clients.index.href()
    : routes.app.clients.index.href({}, { searchParams: params });
}

function summarySection(html: string): string {
  return html.match(/<section aria-label="Client summary"[\s\S]*?<\/section>/)?.[0] ?? '';
}

describe('Clients directory from real data', () => {
  it('renders the reference layout with real Invoice-derived values and no mock placeholders', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'directory-real');
    organizationId = tenant.organizationId;
    let ada = await seedClient({
      legal_name: 'Ada Lovelace',
      preferred_name: 'Ada',
      email: 'ada@example.com',
    });
    let grace = await seedClient({ legal_name: 'Grace Hopper' });
    let overdueInvoice = await seedInvoice({ client_id: ada.id, total_minor: 100_000 });
    let paidInvoice = await seedInvoice({ client_id: grace.id, total_minor: 50_000 });
    await seedPayment(overdueInvoice.id, '2019-12-09', 40_000);
    await seedPayment(paidInvoice.id, '2019-12-05', 50_000);

    let html = await getHtml(router, indexHref(), tenant.sessionCookie);

    // Page furniture from the reference visual language.
    assert.match(html, /Relationships, made easier/);
    assert.match(html, /<h1[^>]*>Clients<\/h1>/);
    assert.match(html, /Add client/);
    assert.match(html, /<th scope="col"[^>]*>Client<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Invoices<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Outstanding<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Last invoice<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Status<\/th>/);
    assert.match(html, /aria-label="Client directory"/);
    assert.match(html, /All clients/);
    assert.match(html, /Needs follow-up/);

    // Real summary values: 2 active clients, 600.00 outstanding, 2 new this month, 6 days.
    let summary = summarySection(html);
    assert.match(summary, /Active clients/);
    assert.match(summary, /Open balance/);
    assert.match(summary, /New this month/);
    assert.match(summary, /Average time to pay/);
    assert.match(summary, /600\.00 INR/);
    assert.match(summary, />6 days</);
    assert.doesNotMatch(summary, /No payment history yet/);

    // Real per-Client values, statuses and profile links.
    assert.match(html, /Ada/);
    assert.match(html, /Ada Lovelace/);
    assert.match(html, new RegExp(`href="${routes.app.clients.show.href({ clientId: ada.id })}"`));
    assert.match(html, /Grace Hopper/);
    assert.match(html, new RegExp(`href="${routes.app.clients.show.href({ clientId: grace.id })}"`));
    assert.match(html, /600\.00 INR/);
    assert.match(html, /0\.00 INR/);
    assert.match(html, /Dec 01, 2019/);
    assert.match(html, /Past due/);
    assert.match(html, /Paid/);

    for (let placeholder of ['Olivia Rhye', 'Studio North', '$4,900', '8.4 days', 'Lena Morris']) {
      assert.ok(!html.includes(placeholder), `the mock placeholder ${placeholder} must not render`);
    }
  });

  it('shows an empty indicator when there is no honest payment history', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'directory-empty');
    organizationId = tenant.organizationId;
    let client = await seedClient({ legal_name: 'Unpaid Client' });
    await seedInvoice({ client_id: client.id, total_minor: 20_000 });

    let html = await getHtml(router, indexHref(), tenant.sessionCookie);
    let summary = summarySection(html);

    assert.match(summary, /Average time to pay/);
    assert.match(summary, /—/);
    assert.match(summary, /No payment history yet/);
    assert.doesNotMatch(summary, />0 days</);
  });

  it('keeps search, type, status, follow-up and pagination links working in the table', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'directory-filters');
    organizationId = tenant.organizationId;
    let ada = await seedClient({
      legal_name: 'Adafiltered Client',
      type: 'individual',
      email: 'ada-filtered@example.com',
    });
    let business = await seedClient({ legal_name: 'Businessfiltered Client', type: 'business' });
    let archived = await seedClient({
      legal_name: 'Archivedfiltered Client',
      status: 'archived',
      archived_at: Date.now(),
    });
    let overdueInvoice = await seedInvoice({ client_id: ada.id, total_minor: 10_000 });
    await seedPayment(overdueInvoice.id, '2019-12-09', 4_000);
    await seedInvoice({ client_id: business.id, total_minor: 5_000, due_date: '2999-01-01' });

    let searched = await getHtml(router, indexHref({ q: 'Adafiltered' }), tenant.sessionCookie);
    assert.match(searched, /Adafiltered Client/);
    assert.doesNotMatch(searched, /Businessfiltered Client/);

    let businesses = await getHtml(router, indexHref({ type: 'business' }), tenant.sessionCookie);
    assert.match(businesses, /Businessfiltered Client/);
    assert.doesNotMatch(businesses, /Adafiltered Client/);

    let archivedView = await getHtml(
      router,
      indexHref({ status: 'archived' }),
      tenant.sessionCookie,
    );
    assert.match(archivedView, /Archivedfiltered Client/);
    assert.doesNotMatch(archivedView, /Adafiltered Client/);

    let followUpView = await getHtml(
      router,
      indexHref({ followup: 'overdue' }),
      tenant.sessionCookie,
    );
    assert.match(followUpView, /Adafiltered Client/);
    assert.doesNotMatch(followUpView, /Businessfiltered Client/);

    let pageTwo = await getHtml(router, indexHref({ page: '2' }), tenant.sessionCookie);
    assert.match(pageTwo, /Showing 0 clients to show|No clients to show/);
    assert.ok(archived);
  });

  it('never shows another Organization’s Clients or Invoices', async () => {
    let owner = await createUserAndLoginWithOrganization(router, db, 'directory-owner');
    organizationId = owner.organizationId;
    let own = await seedClient({ legal_name: 'Own Organization Client' });
    await seedInvoice({ client_id: own.id, total_minor: 70_000 });

    let other = await createUserAndLoginWithOrganization(router, db, 'directory-other');
    let otherOrganizationId = other.organizationId;
    let otherClientId = crypto.randomUUID();
    let now = Date.now();
    await db.create(clients, {
      id: otherClientId,
      organization_id: otherOrganizationId,
      type: 'business',
      legal_name: 'Foreign Organization Client',
      status: 'active',
      archived_at: null,
      created_at: now,
      updated_at: now,
    });
    await seedInvoice({
      client_id: otherClientId,
      total_minor: 900_000,
      organization_id: otherOrganizationId,
    });

    let html = await getHtml(router, indexHref(), owner.sessionCookie);

    assert.match(html, /Own Organization Client/);
    assert.doesNotMatch(html, /Foreign Organization Client/);
    assert.doesNotMatch(summarySection(html), /9,000\.00 INR/);
    assert.match(summarySection(html), /700\.00 INR/);
  });

  it('keeps archive and restore notices visible through the new layout', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'directory-notice');
    organizationId = tenant.organizationId;
    let client = await seedClient({ legal_name: 'Noticed Client' });
    let profilePath = routes.app.clients.show.href({ clientId: client.id });

    let archived = await submitForm(
      router,
      profilePath,
      routes.app.clients.lifecycle.archive.href({ clientId: client.id }),
      { _method: 'PUT' },
      tenant.sessionCookie,
    );
    assert.equal(archived.status, 302);
    let archivedProfile = await getHtml(router, profilePath, tenant.sessionCookie);
    assert.match(archivedProfile, /<p role="status"[^>]*>Client archived<\/p>/);

    let archivedDirectory = await getHtml(
      router,
      indexHref({ status: 'archived' }),
      tenant.sessionCookie,
    );
    assert.match(archivedDirectory, /Noticed Client/);
    assert.match(archivedDirectory, /<nav aria-label="Client status"/);

    let restored = await submitForm(
      router,
      profilePath,
      routes.app.clients.lifecycle.restore.href({ clientId: client.id }),
      { _method: 'PUT' },
      tenant.sessionCookie,
    );
    assert.equal(restored.status, 302);
    let restoredProfile = await getHtml(router, profilePath, tenant.sessionCookie);
    assert.match(restoredProfile, /<p role="status"[^>]*>Client restored<\/p>/);
  });
});
