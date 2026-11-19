import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import {
  clients,
  clientForInvoice,
  creditNoteLines,
  creditNoteLinesByPosition,
  creditNotes,
  invoiceForCreditNote,
  invoiceLineForCreditNoteLine,
  invoiceLines,
  invoiceLinesByPosition,
  invoicePayments,
  invoicePdfArtifacts,
  invoices,
  invoicesForClient,
  membershipsForOrganization,
  membershipsForUser,
  organizationForClient,
  organizationMemberships,
  organizations,
  paymentsForInvoice,
  pdfArtifactForInvoice,
  sessionsForUser,
  users,
} from '../db.ts';
import { testDb as db } from '../../../test/db-setup.ts';

async function createOrganization(name: string): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(organizations, { id, name, created_at: now, updated_at: now });
  return id;
}

async function createUser(): Promise<string> {
  let id = crypto.randomUUID();
  await db.create(users, {
    id,
    email: `user-${crypto.randomUUID()}@example.com`,
    email_verified: true,
    created_at: Date.now(),
  });
  return id;
}

async function createClient(organizationId: string, legalName: string): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(clients, {
    id,
    organization_id: organizationId,
    type: 'business',
    legal_name: legalName,
    status: 'active',
    archived_at: null,
    created_at: now,
    updated_at: now,
  });
  return id;
}

async function createIssuedInvoice(
  organizationId: string,
  clientId: string,
  invoiceNumber: string,
): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(invoices, {
    id,
    organization_id: organizationId,
    client_id: clientId,
    document_type: 'invoice',
    status: 'issued',
    invoice_number: invoiceNumber,
    issued_at: now,
    seller_legal_name: 'Relations Studio',
    seller_address_line1: '12 Linking Road',
    seller_country: 'India',
    currency: 'INR',
    invoice_date: '2026-11-01',
    due_date: '2026-11-01',
    payment_term: 'due_on_receipt',
    recipient_legal_name: 'Relations Client',
    recipient_gstin_applicable: false,
    reverse_charge: false,
    subtotal_minor: 3000,
    line_discount_total_minor: 0,
    invoice_discount_minor: 0,
    net_subtotal_minor: 3000,
    round_off_minor: 0,
    total_minor: 3000,
    created_at: now,
    updated_at: now,
  });
  return id;
}

async function createInvoiceLine(
  organizationId: string,
  invoiceId: string,
  position: number,
  description: string,
): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(invoiceLines, {
    id,
    organization_id: organizationId,
    invoice_id: invoiceId,
    position,
    description,
    quantity: '1',
    unit_price: '1000',
    amount_minor: 1000,
    discount_mode: null,
    discount_value: null,
    line_discount_minor: 0,
    allocated_invoice_discount_minor: 0,
    net_minor: 1000,
    cgst_amount_minor: 0,
    sgst_amount_minor: 0,
    igst_amount_minor: 0,
    foreign_tax_amount_minor: 0,
    created_at: now,
    updated_at: now,
  });
  return id;
}

describe('typed table relations', () => {
  it('loads an organization and its user through their memberships', async () => {
    let organizationId = await createOrganization('Relations Org Studio');
    let userId = await createUser();
    let now = Date.now();
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      is_owner: true,
      created_at: now,
    });

    let organization = await db.find(organizations, organizationId, {
      with: { memberships: membershipsForOrganization },
    });
    assert.ok(organization);
    assert.equal(organization.memberships.length, 1);
    assert.equal(organization.memberships[0].user_id, userId);

    let user = await db.find(users, userId, {
      with: { memberships: membershipsForUser },
    });
    assert.ok(user);
    assert.equal(user.memberships.length, 1);
    assert.equal(user.memberships[0].organization_id, organizationId);
  });

  it('loads a user with empty memberships and sessions before any exist', async () => {
    let userId = await createUser();

    let user = await db.find(users, userId, {
      with: { memberships: membershipsForUser, sessions: sessionsForUser },
    });
    assert.ok(user);
    assert.equal(user.memberships.length, 0);
    assert.equal(user.sessions.length, 0);
  });

  it('loads a client with its organization and invoices', async () => {
    let organizationId = await createOrganization('Relations Client Studio');
    let clientId = await createClient(organizationId, 'Relations Client');
    let firstInvoiceId = await createIssuedInvoice(organizationId, clientId, 'INV/26-27/0001');
    let secondInvoiceId = await createIssuedInvoice(organizationId, clientId, 'INV/26-27/0002');

    let client = await db.find(clients, clientId, {
      with: { organization: organizationForClient, invoices: invoicesForClient },
    });
    assert.ok(client);
    assert.ok(client.organization);
    assert.equal(client.organization.name, 'Relations Client Studio');
    assert.equal(client.invoices.length, 2);
    assert.deepEqual(
      client.invoices.map((invoice) => invoice.id).sort(),
      [firstInvoiceId, secondInvoiceId].sort(),
    );
  });

  it('loads an invoice with its client, ordered lines, and payments', async () => {
    let organizationId = await createOrganization('Relations Invoice Studio');
    let clientId = await createClient(organizationId, 'Relations Invoice Client');
    let invoiceId = await createIssuedInvoice(organizationId, clientId, 'INV/26-27/0003');
    await createInvoiceLine(organizationId, invoiceId, 2, 'Third review');
    await createInvoiceLine(organizationId, invoiceId, 0, 'First review');
    await createInvoiceLine(organizationId, invoiceId, 1, 'Second review');

    let paymentId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoicePayments, {
      id: paymentId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      payment_date: '2026-11-05',
      amount_minor: 1500,
      payment_method: 'upi',
      reference: null,
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
    });

    let invoice = await db.find(invoices, invoiceId, {
      with: {
        client: clientForInvoice,
        lines: invoiceLinesByPosition,
        payments: paymentsForInvoice,
      },
    });
    assert.ok(invoice);
    assert.ok(invoice.client);
    assert.equal(invoice.client.legal_name, 'Relations Invoice Client');
    assert.deepEqual(
      invoice.lines.map((line) => line.description),
      ['First review', 'Second review', 'Third review'],
    );
    assert.equal(invoice.payments.length, 1);
    assert.equal(invoice.payments[0].amount_minor, 1500);
  });

  it('loads an invoice with its issued PDF artifact', async () => {
    let organizationId = await createOrganization('Relations Artifact Studio');
    let clientId = await createClient(organizationId, 'Relations Artifact Client');
    let invoiceId = await createIssuedInvoice(organizationId, clientId, 'INV/26-27/0004');

    let artifactId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoicePdfArtifacts, {
      id: artifactId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      data: Buffer.from('%PDF-relations'),
      created_at: now,
      updated_at: now,
    });

    let invoice = await db.find(invoices, invoiceId, {
      with: { pdfArtifact: pdfArtifactForInvoice },
    });
    assert.ok(invoice);
    assert.ok(invoice.pdfArtifact);
    let data = invoice.pdfArtifact.data;
    assert.equal(
      typeof data === 'string' ? data : Buffer.from(data as Uint8Array).toString(),
      '%PDF-relations',
    );
  });

  it('loads a credit note with its lines, invoice, and credited invoice line', async () => {
    let organizationId = await createOrganization('Relations Note Studio');
    let clientId = await createClient(organizationId, 'Relations Note Client');
    let invoiceId = await createIssuedInvoice(organizationId, clientId, 'INV/26-27/0005');
    let invoiceLineId = await createInvoiceLine(organizationId, invoiceId, 0, 'Credited review');
    let now = Date.now();

    let noteId = crypto.randomUUID();
    await db.create(creditNotes, {
      id: noteId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      status: 'draft',
      credit_note_number: null,
      credit_date: '2026-11-05',
      reason: 'Scope reduced',
      issued_at: null,
      subtotal_minor: 500,
      line_discount_total_minor: 0,
      invoice_discount_mode: null,
      invoice_discount_minor: 0,
      net_subtotal_minor: 500,
      tax_total_minor: 0,
      round_off_minor: 0,
      total_minor: 500,
      created_at: now,
      updated_at: now,
    });
    let noteLineId = crypto.randomUUID();
    await db.create(creditNoteLines, {
      id: noteLineId,
      organization_id: organizationId,
      credit_note_id: noteId,
      invoice_id: invoiceId,
      invoice_line_id: invoiceLineId,
      position: 0,
      description: 'Credited review',
      quantity: '1',
      unit_price: '1000',
      amount_minor: 500,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 500,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
    });

    let note = await db.find(creditNotes, noteId, {
      with: { invoice: invoiceForCreditNote, lines: creditNoteLinesByPosition },
    });
    assert.ok(note);
    assert.ok(note.invoice);
    assert.equal(note.invoice.id, invoiceId);
    assert.equal(note.lines.length, 1);

    let noteLine = await db.find(creditNoteLines, noteLineId, {
      with: { invoiceLine: invoiceLineForCreditNoteLine },
    });
    assert.ok(noteLine);
    assert.ok(noteLine.invoiceLine);
    assert.equal(noteLine.invoiceLine.description, 'Credited review');
  });
});
