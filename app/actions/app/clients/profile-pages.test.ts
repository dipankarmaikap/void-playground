import * as assert from 'remix/assert';
import { beforeEach, describe, it } from 'remix/test';

import type { Client, Invoice } from '../../../data/db.ts';
import { clients, invoicePayments, invoices } from '../../../data/db.ts';
import { clearTestTables } from '../../../../test/db-setup.ts';
import { createTestRouter } from '../../../../test/router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  postForm,
} from '../../../../test/http.ts';

const { router, db } = await createTestRouter();

let organizationId = '';

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
      type: 'business',
      legal_name: `Profile Client ${crypto.randomUUID()}`,
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
      client_id: crypto.randomUUID(),
      document_type: 'invoice',
      status: 'issued',
      invoice_number: `INV/${crypto.randomUUID()}`,
      issued_at: now,
      seller_legal_name: 'Profile Seller',
      seller_address_line1: '1 Profile Street',
      seller_country: 'IN',
      seller_gst_registered: false,
      currency: 'INR',
      invoice_date: '2019-12-01',
      due_date: '2020-01-01',
      payment_term: 'net_30',
      recipient_legal_name: 'Profile Recipient',
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

describe('Client detail, new and edit pages', () => {
  it('renders the reference detail header, real Invoice-derived cards and invoice history', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'profile-detail');
    organizationId = tenant.organizationId;
    let client = await seedClient({
      legal_name: 'Ada Lovelace',
      trading_name: 'Analytical Engines',
      industry: 'Computing',
      email: 'ada@example.com',
      phone: '+91 98765 43210',
      billing_line1: '12 Example Street',
      billing_locality: 'Kolkata',
      billing_currency: 'INR',
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: '27AAPFU0939F1ZV',
    });
    let paid = await seedInvoice({
      client_id: client.id,
      invoice_number: 'INV-1001',
      total_minor: 50_000,
      invoice_date: '2019-09-01',
    });
    let overdue = await seedInvoice({
      client_id: client.id,
      invoice_number: 'INV-1002',
      total_minor: 100_000,
    });
    await seedPayment(paid.id, '2019-09-10', 50_000);

    let html = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: client.id }),
      tenant.sessionCookie,
    );

    // Reference detail header with the real Client and real route-contract links.
    assert.match(html, /All clients/);
    // A Business's display label is its trading name; its legal name still renders in the details.
    assert.match(html, /<h1[^>]*>Analytical Engines<\/h1>/);
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /Active client/);
    assert.match(html, /Client since/);
    assert.ok(html.includes(routes.app.clients.edit.href({ clientId: client.id })));
    assert.ok(html.includes(routes.app.clients.index.href()));
    assert.ok(
      html.includes(routes.app.invoices.index.href({}, { searchParams: { clientId: client.id } })),
    );
    assert.ok(
      html.includes(routes.app.invoices.new.href({}, { searchParams: { clientId: client.id } })),
    );

    // Stat cards derived from this Client's real Invoices and Payments.
    assert.match(html, /Total invoiced/);
    assert.match(html, /1,500\.00 INR/);
    assert.match(html, /Outstanding/);
    assert.match(html, /1,000\.00 INR/);
    assert.match(html, /Invoices paid/);
    assert.match(html, /1 \/ 2/);
    assert.match(html, /Average time to pay/);
    assert.match(html, /9 days/);

    // Invoice history table with real rows, amounts and derived statuses.
    assert.match(html, /Invoice history/);
    assert.match(html, /<th scope="col"[^>]*>Invoice<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Issued<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Amount<\/th>/);
    assert.match(html, /<th scope="col"[^>]*>Status<\/th>/);
    assert.match(html, /INV-1001/);
    assert.match(html, /INV-1002/);
    assert.match(html, /Past due/);
    assert.ok(html.includes(routes.app.invoices.show.href({ invoiceId: paid.id })));
    assert.ok(html.includes(routes.app.invoices.show.href({ invoiceId: overdue.id })));

    // Real read-only details, reusing the shared summary language.
    assert.match(html, /Analytical Engines/);
    assert.match(html, /ada@example.com/);
    assert.match(html, /Billing address/);
    assert.match(html, /Tax identifier/);
    assert.match(html, /<dd[^>]*>Active<\/dd>/);

    for (let placeholder of ['Olivia Rhye', 'Studio North', '$18,650', '8.4 days', 'Lena Morris']) {
      assert.ok(!html.includes(placeholder), `the mock placeholder ${placeholder} must not render`);
    }
  });

  it('shows empty indicators for a Client with no Invoice history', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'profile-empty');
    organizationId = tenant.organizationId;
    let client = await seedClient({ legal_name: 'Fresh Profile Client' });

    let html = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: client.id }),
      tenant.sessionCookie,
    );

    assert.match(html, /<h1[^>]*>Fresh Profile Client<\/h1>/);
    assert.match(html, /Total invoiced/);
    assert.match(html, /0\.00 INR/);
    assert.match(html, /Invoices paid/);
    assert.match(html, /0 \/ 0/);
    assert.match(html, /Average time to pay/);
    assert.match(html, /—/);
    assert.match(html, /No payment history yet/);
    assert.match(html, /No invoices/);
    assert.ok(html.includes(routes.app.clients.index.href()));
  });

  it('renders reference form panels with hints and keeps the no-JS form contract', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'profile-forms');
    organizationId = tenant.organizationId;

    let newPage = await getHtml(router, routes.app.clients.new.href(), tenant.sessionCookie);
    assert.match(newPage, /Grow your circle/);
    assert.match(newPage, /<h1[^>]*>Add a client<\/h1>/);
    for (let section of [
      'Client details',
      'Contact details',
      'Tax identifier',
      'Billing address',
    ]) {
      assert.ok(newPage.includes(section), `the form panel should include ${section}`);
    }
    assert.match(newPage, /Tell us who you/);
    assert.match(newPage, /Shown on invoices sent to this client/);
    assert.match(newPage, /<form[^>]*method="POST"[^>]*action="\/app\/clients"/);
    assert.match(newPage, /name="_csrf" value="[^"]+"/);
    assert.match(newPage, /name="legal_name"/);
    assert.ok(newPage.includes(`href="${routes.app.clients.index.href()}"`));

    let client = await seedClient({ legal_name: 'Form Client', preferred_name: 'Formy' });
    let editPage = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: client.id }),
      tenant.sessionCookie,
    );
    assert.match(editPage, /<h1[^>]*>Edit Form Client<\/h1>/);
    assert.match(editPage, /Client details/);
    assert.match(editPage, /name="_method" value="PUT"/);
    assert.match(
      editPage,
      new RegExp(`action="${routes.app.clients.update.href({ clientId: client.id })}"`),
    );
    assert.match(editPage, /name="legal_name"[^>]*value="Form Client"/);
    assert.ok(editPage.includes(`href="${routes.app.clients.show.href({ clientId: client.id })}"`));

    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      { type: '', legal_name: '' },
      tenant.sessionCookie,
    );
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Client details/);
    assert.match(html, /name="legal_name"[^>]*aria-invalid="true"/);
  });
});
