import * as assert from 'remix/assert';
import { beforeEach, describe, it } from 'remix/test';

import {
  clients,
  creditNotes,
  invoicePayments,
  invoiceRefunds,
  invoices,
  organizations,
} from './db.ts';
import type { Client, Invoice } from './db.ts';
import { clearTestTables, testDb } from '../../test/db-setup.ts';
import { getClientDirectoryFacts, getClientProfileFacts } from './client-directory-facts.ts';

let organizationId: string;

beforeEach(async () => {
  await clearTestTables(
    testDb,
    creditNotes,
    invoiceRefunds,
    invoicePayments,
    invoices,
    clients,
    organizations,
  );
  organizationId = crypto.randomUUID();
  await seedOrganization(organizationId);
});

async function seedOrganization(id: string) {
  let now = Date.now();
  await testDb.create(organizations, {
    id,
    name: `Facts Organization ${id}`,
    created_at: now,
    updated_at: now,
  });
}

async function seedClient(overrides: Partial<Client> = {}) {
  let now = Date.now();
  return testDb.create(
    clients,
    {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: 'business',
      legal_name: `Facts Client ${crypto.randomUUID()}`,
      status: 'active',
      archived_at: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    },
    { returnRow: true },
  );
}

async function seedInvoice(overrides: Partial<Invoice> = {}) {
  let now = Date.now();
  let total = overrides.total_minor ?? 100_000;
  return testDb.create(
    invoices,
    {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      client_id: overrides.client_id ?? crypto.randomUUID(),
      document_type: 'invoice',
      status: 'issued',
      invoice_number: `INV/${crypto.randomUUID()}`,
      issued_at: now,
      seller_legal_name: 'Facts Seller',
      seller_address_line1: '1 Facts Street',
      seller_country: 'IN',
      seller_gst_registered: false,
      currency: 'INR',
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      payment_term: 'net_15',
      recipient_legal_name: 'Facts Recipient',
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
  await testDb.create(invoicePayments, {
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

describe('client directory facts', () => {
  it('derives summary counts and balances from real Clients, Invoices and Payments', async () => {
    let client = await seedClient();
    let first = await seedInvoice({ client_id: client.id, total_minor: 100_000 });
    let second = await seedInvoice({ client_id: client.id, total_minor: 50_000 });
    await seedPayment(first.id, '2026-10-09', 40_000);
    await seedPayment(second.id, '2026-10-13', 50_000);

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.activeClientCount, 1);
    assert.equal(facts.summary.outstandingBalanceMinor, 60_000);
    assert.equal(facts.summary.averageCollectionDays, 10);
    assert.equal(facts.clients.get(client.id)?.invoiceCount, 2);
    assert.equal(facts.clients.get(client.id)?.outstandingBalanceMinor, 60_000);
    assert.equal(facts.clients.get(client.id)?.lastInvoiceDate, '2026-10-01');
  });

  it('returns an empty indicator rather than a placeholder when there is no payment history', async () => {
    await seedInvoice({ client_id: (await seedClient()).id });

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.averageCollectionDays, null);
  });

  it('ignores voided payments when deriving balances and collection time', async () => {
    let client = await seedClient();
    let invoice = await seedInvoice({ client_id: client.id, total_minor: 100_000 });
    await seedPayment(invoice.id, '2026-10-05', 40_000);
    let now = Date.now();
    await testDb.create(invoicePayments, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      payment_date: '2026-10-25',
      amount_minor: 60_000,
      payment_method: 'bank_transfer',
      reference: null,
      voided_at: now,
      void_reason: 'recorded in error',
      created_at: now,
      updated_at: now,
    });

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.outstandingBalanceMinor, 60_000);
    assert.equal(facts.summary.averageCollectionDays, 4);
  });

  it('derives Invoice display statuses from the Kolkata calendar date', async () => {
    let overdueClient = await seedClient({ legal_name: 'Overdue Facts Client' });
    let paidClient = await seedClient({ legal_name: 'Paid Facts Client' });
    let noInvoicesClient = await seedClient({ legal_name: 'Quiet Facts Client' });
    let overdueInvoice = await seedInvoice({ client_id: overdueClient.id, total_minor: 80_000 });
    let paidInvoice = await seedInvoice({ client_id: paidClient.id, total_minor: 30_000 });
    await seedPayment(paidInvoice.id, '2026-10-10', 30_000);

    let beforeDue = await getClientDirectoryFacts(testDb, organizationId, '2026-10-14');
    assert.equal(beforeDue.clients.get(overdueClient.id)?.status, 'sent');
    assert.equal(beforeDue.clients.get(paidClient.id)?.status, 'paid');
    assert.equal(beforeDue.clients.get(noInvoicesClient.id)?.status, null);
    assert.equal(beforeDue.clients.get(noInvoicesClient.id)?.invoiceCount, 0);

    let afterDue = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');
    assert.equal(afterDue.clients.get(overdueInvoice.client_id)?.status, 'overdue');
    assert.equal(afterDue.clients.get(overdueClient.id)?.hasOverdueInvoice, true);
    assert.equal(afterDue.clients.get(paidClient.id)?.hasOverdueInvoice, false);
  });

  it('counts Clients created in the current Kolkata calendar month', async () => {
    await seedClient({
      legal_name: 'This Month',
      created_at: Date.parse('2026-11-01T00:30:00Z'),
    });
    // 18:30 UTC on the last day of October is already 1 November in Kolkata.
    await seedClient({
      legal_name: 'Kolkata Month Boundary',
      created_at: Date.parse('2026-10-31T18:30:00Z'),
    });
    await seedClient({
      legal_name: 'Last Month',
      created_at: Date.parse('2026-10-31T18:29:00Z'),
    });

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.newClientsThisMonth, 2);
    assert.equal(facts.summary.activeClientCount, 3);
  });

  it('picks an overdue status when equal-dated invoices tie, regardless of row order', async () => {
    let paidFirst = await seedClient({ legal_name: 'Paid First Client' });
    let overdueFirst = await seedClient({ legal_name: 'Overdue First Client' });
    let now = Date.now();

    let unpaidFirst = await seedInvoice({
      id: 'zz-unpaid-first',
      client_id: paidFirst.id,
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      created_at: now,
    });
    let paidLast = await seedInvoice({
      id: 'aa-paid-last',
      client_id: paidFirst.id,
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      created_at: now,
    });
    await seedPayment(paidLast.id, '2026-10-05', 100_000);
    assert.ok(unpaidFirst);

    let paidInvoice = await seedInvoice({
      id: 'aa-paid-first',
      client_id: overdueFirst.id,
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      created_at: now,
    });
    let unpaidLast = await seedInvoice({
      id: 'zz-unpaid-last',
      client_id: overdueFirst.id,
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      created_at: now,
    });
    await seedPayment(paidInvoice.id, '2026-10-05', 100_000);
    assert.ok(unpaidLast);

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.clients.get(paidFirst.id)?.status, 'overdue');
    assert.equal(facts.clients.get(paidFirst.id)?.hasOverdueInvoice, true);
    assert.equal(facts.clients.get(overdueFirst.id)?.status, 'overdue');
    assert.equal(facts.clients.get(overdueFirst.id)?.hasOverdueInvoice, true);
  });

  it('excludes archived Clients from the new-this-month count', async () => {
    await seedClient({
      legal_name: 'Active This Month',
      created_at: Date.parse('2026-11-02T05:00:00Z'),
    });
    await seedClient({
      legal_name: 'Archived This Month',
      status: 'archived',
      archived_at: Date.parse('2026-11-10T05:00:00Z'),
      created_at: Date.parse('2026-11-03T05:00:00Z'),
    });
    await seedClient({
      legal_name: 'Active Last Month',
      created_at: Date.parse('2026-10-03T05:00:00Z'),
    });

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.newClientsThisMonth, 1);
    assert.equal(facts.summary.activeClientCount, 2);
  });

  it('never mixes another Organization into its summary or per-Client facts', async () => {
    let ownClient = await seedClient({ legal_name: 'Own Organization Client' });
    let ownInvoice = await seedInvoice({ client_id: ownClient.id, total_minor: 70_000 });
    await seedPayment(ownInvoice.id, '2026-10-04', 20_000);

    let foreignOrganizationId = crypto.randomUUID();
    await seedOrganization(foreignOrganizationId);
    let now = Date.now();
    let foreignClient = await testDb.create(
      clients,
      {
        id: crypto.randomUUID(),
        organization_id: foreignOrganizationId,
        type: 'business',
        legal_name: 'Other Organization Client',
        status: 'active',
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      { returnRow: true },
    );
    await testDb.create(invoices, {
      ...(await testDb.find(invoices, ownInvoice.id))!,
      id: crypto.randomUUID(),
      organization_id: foreignOrganizationId,
      client_id: foreignClient.id,
      total_minor: 900_000,
      net_subtotal_minor: 900_000,
      subtotal_minor: 900_000,
      invoice_number: `INV/${crypto.randomUUID()}`,
    });

    let facts = await getClientDirectoryFacts(testDb, organizationId, '2026-11-19');

    assert.equal(facts.summary.activeClientCount, 1);
    assert.equal(facts.summary.outstandingBalanceMinor, 50_000);
    assert.equal(facts.summary.averageCollectionDays, 3);
    assert.equal(facts.clients.size, 1);
    assert.equal(facts.clients.get(foreignClient.id), undefined);
  });
});

describe('client profile facts', () => {
  it('derives one Client’s totals, paid count and history from real Invoices and Payments', async () => {
    let client = await seedClient();
    let otherClient = await seedClient();
    let paid = await seedInvoice({
      client_id: client.id,
      total_minor: 50_000,
      invoice_date: '2026-09-01',
      due_date: '2026-09-15',
    });
    let unpaid = await seedInvoice({ client_id: client.id, total_minor: 100_000 });
    await seedPayment(paid.id, '2026-09-10', 50_000);
    await seedInvoice({ client_id: otherClient.id, total_minor: 900_000 });

    let facts = await getClientProfileFacts(testDb, organizationId, client.id, '2026-11-19');

    assert.equal(facts.currency, 'INR');
    assert.equal(facts.invoiceCount, 2);
    assert.equal(facts.totalInvoicedMinor, 150_000);
    assert.equal(facts.outstandingBalanceMinor, 100_000);
    assert.equal(facts.paidInvoiceCount, 1);
    assert.equal(facts.averageCollectionDays, 9);
    assert.deepEqual(
      facts.invoices.map((invoice) => invoice.id),
      [unpaid.id, paid.id],
      'most recent Invoice first, and no other Client’s Invoice',
    );
    assert.deepEqual(
      facts.invoices.map((invoice) => invoice.status),
      ['overdue', 'paid'],
    );
  });

  it('reports an empty collection average and no history when the Client has no Invoices', async () => {
    let client = await seedClient();

    let facts = await getClientProfileFacts(testDb, organizationId, client.id, '2026-11-19');

    assert.equal(facts.invoiceCount, 0);
    assert.equal(facts.totalInvoicedMinor, 0);
    assert.equal(facts.outstandingBalanceMinor, 0);
    assert.equal(facts.paidInvoiceCount, 0);
    assert.equal(facts.averageCollectionDays, null);
    assert.equal(facts.invoices.length, 0);
  });
});
