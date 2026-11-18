import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import {
  db,
  creditNotePdfArtifacts,
  documentSequences,
  invoiceLines,
  invoices,
  organizationInvoicingProfiles,
} from '../../../data/db.ts';
import { todayInKolkata } from '../../../data/invoices/dates.ts';
import { issueCreditNoteDraft } from '../../../data/invoices/credit-notes.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  submitForm,
} from '../../../../test/http.ts';
import { seedInvoice } from '../../../../test/invoice-fixtures.ts';

async function createIssuedInvoice(
  organizationId: string,
  clientId: string,
  invoiceDate = todayInKolkata(),
): Promise<{ invoiceId: string; lineId: string }> {
  let invoiceId = crypto.randomUUID();
  let lineId = crypto.randomUUID();
  let now = Date.now();
  await seedInvoice(organizationId, clientId, {
    id: invoiceId,
    recipientName: 'Credit Note Recipient',
    invoiceDate,
  });
  await db.update(invoices, invoiceId, {
    status: 'issued',
    invoice_number: `INV/${invoiceId}`,
    issued_at: now,
    seller_legal_name: 'Credit Note Seller',
    seller_address_line1: '1 Seller Road',
    seller_country: 'IN',
    recipient_billing_line1: '2 Recipient Road',
    recipient_billing_country: 'IN',
  });
  await db.create(invoiceLines, {
    id: lineId,
    organization_id: organizationId,
    invoice_id: invoiceId,
    position: 0,
    description: 'Consulting services',
    sac: '998314',
    quantity: '1.0000',
    unit_price: '10.0000',
    amount_minor: 1000,
    discount_mode: null,
    discount_value: null,
    line_discount_minor: 0,
    allocated_invoice_discount_minor: 0,
    net_minor: 1000,
    tax_treatment: null,
    gst_rate: null,
    cgst_rate: null,
    sgst_rate: null,
    igst_rate: null,
    cgst_amount_minor: 0,
    sgst_amount_minor: 0,
    igst_amount_minor: 0,
    foreign_tax_label: null,
    foreign_tax_mode: null,
    foreign_tax_rate: null,
    foreign_tax_amount_minor: 0,
    created_at: now,
    updated_at: now,
  });
  return { invoiceId, lineId };
}

async function createCreditNoteDraft(
  sessionCookie: string,
  invoiceId: string,
  lineId: string,
  quantity: string,
  reason: string,
  creditDate = todayInKolkata(),
): Promise<string> {
  let response = await submitForm(
    router,
    routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
    routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
    {
      credit_date: creditDate,
      reason,
      line_id: lineId,
      line_quantity: quantity,
    },
    sessionCookie,
  );
  assert.equal(response.status, 302);
  let location = response.headers.get('Location');
  assert.ok(location);
  return new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;
}

async function issueCreditNote(
  sessionCookie: string,
  invoiceId: string,
  creditNoteId: string,
): Promise<Response> {
  return submitForm(
    router,
    routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
    routes.app.invoices.creditNotes.lifecycle.issue.href({ invoiceId, creditNoteId }),
    {},
    sessionCookie,
  );
}

async function setInvoiceTaxSnapshot(
  invoiceId: string,
  lineId: string,
  tax:
    | {
        mode: 'india_gst';
        placeOfSupplyStateCode: string;
        component: 'intra_state' | 'inter_state';
      }
    | { mode: 'foreign_manual' },
): Promise<void> {
  let now = Date.now();
  let gst = tax.mode === 'india_gst';
  let isIntraState = tax.mode === 'india_gst' && tax.component === 'intra_state';
  let taxTotal = gst ? 1800 : 800;
  await db.update(invoices, invoiceId, {
    gst_mode: tax.mode,
    supply_type: gst ? 'domestic' : null,
    place_of_supply_state_code:
      tax.mode === 'india_gst' ? tax.placeOfSupplyStateCode : null,
    place_of_supply_state_name: gst ? 'Test State' : null,
    place_of_supply_country: null,
    subtotal_minor: 10000,
    net_subtotal_minor: 10000,
    tax_total_minor: taxTotal,
    total_minor: 10000 + taxTotal,
    updated_at: now,
  });
  await db.update(invoiceLines, lineId, {
    quantity: '1.0000',
    unit_price: '100.0000',
    amount_minor: 10000,
    net_minor: 10000,
    tax_treatment: gst ? 'taxable' : null,
    gst_rate: gst ? '18' : null,
    cgst_rate: isIntraState ? '9' : null,
    sgst_rate: isIntraState ? '9' : null,
    igst_rate: gst && !isIntraState ? '18' : null,
    cgst_amount_minor: isIntraState ? 900 : 0,
    sgst_amount_minor: isIntraState ? 900 : 0,
    igst_amount_minor: gst && !isIntraState ? 1800 : 0,
    foreign_tax_label: gst ? null : 'VAT',
    foreign_tax_mode: gst ? null : 'percent',
    foreign_tax_rate: gst ? null : '8',
    foreign_tax_amount_minor: gst ? 0 : 800,
    updated_at: now,
  });
}

describe('credit notes', () => {
  it('starts a Credit Note Draft from an issued invoice snapshot and its remaining service lines', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-prefill',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId } = await createIssuedInvoice(organizationId, client.id);

    let html = await getHtml(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      sessionCookie,
    );

    assert.match(html, /New credit note draft/i);
    assert.match(html, /Credit Note Seller/);
    assert.match(html, /Credit Note Recipient/);
    assert.match(html, /INV\//);
    assert.match(html, /Consulting services/);
    assert.match(html, /998314/);
    assert.match(html, /name="credit_date"/);
    assert.match(html, new RegExp(`name="credit_date"[^>]*value="${todayInKolkata()}"`));
    assert.match(html, /name="reason"/);
    assert.match(html, /name="line_quantity"/);
  });

  it('creates a Draft with the submitted reason, date, and partial quantity', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-create',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditDate = todayInKolkata();

    let created = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: creditDate,
        reason: 'Reduced scope',
        line_id: lineId,
        line_quantity: '0.5000',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;

    let edit = await getHtml(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      sessionCookie,
    );
    assert.match(edit, /Edit credit note draft/);
    assert.match(edit, /Reduced scope/);
    assert.match(edit, new RegExp(`name="credit_date"[^>]*value="${creditDate}"`));
    assert.match(edit, /name="line_quantity"[^>]*value="0\.5"/);
    assert.match(edit, /Draft credit amount: 5\.00 INR/);
  });

  it('requires a non-blank reason and a credit-note date on or after the invoice date', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-validation',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceDate = '2026-10-01';
    let { invoiceId, lineId } = await createIssuedInvoice(
      organizationId,
      client.id,
      invoiceDate,
    );

    let invalidDate = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: '2026-09-30',
        reason: ' \t ',
        line_id: lineId,
        line_quantity: '0.5',
      },
      sessionCookie,
    );
    assert.equal(invalidDate.status, 400);
    let invalidHtml = await invalidDate.text();
    assert.match(invalidHtml, /cannot be earlier than the original invoice date/i);
    assert.match(invalidHtml, /Enter a reason for this credit note/i);
    let parent = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(parent, /Status: Overdue/);
    assert.match(parent, /Balance due: 10\.00 INR/);
    assert.doesNotMatch(parent, /Credit note Draft/);
  });

  it('edits only a Draft and keeps its parent invoice balance and status unchanged', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-edit',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditDate = todayInKolkata();
    let created = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: creditDate,
        reason: 'Original scope',
        line_id: lineId,
        line_quantity: '0.5000',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;

    let edited = await submitForm(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      routes.app.invoices.creditNotes.edit.action.href({ invoiceId, creditNoteId }),
      {
        credit_date: creditDate,
        reason: 'Reduced scope after review',
        line_id: lineId,
        line_quantity: '0.2500',
      },
      sessionCookie,
    );
    assert.equal(edited.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      sessionCookie,
    );
    assert.match(detail, /Reduced scope after review/);
    assert.match(detail, /name="line_quantity"[^>]*value="0\.25"/);
    assert.match(detail, /Draft credit amount: 2\.50 INR/);

    let parent = await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie);
    assert.match(parent, /Status: Sent/);
    assert.match(parent, /Balance due: 10\.00 INR/);
  });

  it('discards a Credit Note Draft without changing its issued parent invoice', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-discard',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let created = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: todayInKolkata(),
        reason: 'Temporary adjustment',
        line_id: lineId,
        line_quantity: '0.5000',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;

    let discarded = await submitForm(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      routes.app.invoices.creditNotes.lifecycle.discard.href({ invoiceId, creditNoteId }),
      {},
      sessionCookie,
    );
    assert.equal(discarded.status, 302);
    assert.equal(
      discarded.headers.get('Location'),
      routes.app.invoices.show.href({ invoiceId }),
    );

    let missingDraft = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(missingDraft.status, 404);
    let parent = await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie);
    assert.match(parent, /Status: Sent/);
    assert.match(parent, /Balance due: 10\.00 INR/);
  });

  it('previews a watermarked Draft Credit Note PDF without allocating its CN number', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-preview',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditDate = todayInKolkata();
    let created = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: creditDate,
        reason: 'Half of the scope was cancelled',
        line_id: lineId,
        line_quantity: '0.5000',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;

    let preview = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get('Content-Type'), 'application/pdf');
    let bytes = new Uint8Array(await preview.arrayBuffer());
    let pdf = new TextDecoder('latin1').decode(bytes);
    assert.equal(pdf.slice(0, 5), '%PDF-');
    assert.match(pdf, /DRAFT/);
    assert.match(pdf, /CREDIT NOTE/);
    assert.match(pdf, /Credit note no: DRAFT/);
    assert.match(pdf, /Credit note date:/);
    assert.match(pdf, /Original invoice no: INV\//);
    assert.match(pdf, /Original invoice date:/);
    assert.match(pdf, /Half of the scope was cancelled/);
    assert.match(pdf, /Credit Note Seller/);
    assert.match(pdf, /Credit Note Recipient/);
    assert.match(pdf, /Consulting services/);
    assert.match(pdf, /998314/);
    assert.match(pdf, /5\.00 INR/);
    assert.match(pdf, /Rupees Five Only/);
    assert.equal(
      await db.count(documentSequences, {
        where: { organization_id: organizationId, document_type: 'credit_note' },
      }),
      0,
    );
  });

  it('issues a Credit Note with its configured FY number and serves the immutable stored PDF', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-issue',
    );
    await db.create(organizationInvoicingProfiles, {
      organization_id: organizationId,
      credit_note_prefix: 'ADJ',
      credit_note_starting_number: 7,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditDate = todayInKolkata();
    let created = await submitForm(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      routes.app.invoices.creditNotes.new.action.href({ invoiceId }),
      {
        credit_date: creditDate,
        reason: 'Service scope reduced',
        line_id: lineId,
        line_quantity: '0.5000',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;

    let issuePath = routes.app.invoices.creditNotes.lifecycle.issue.href({
      invoiceId,
      creditNoteId,
    });
    let issued = await submitForm(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      issuePath,
      {},
      sessionCookie,
    );
    assert.equal(issued.status, 302);
    assert.equal(
      issued.headers.get('Location'),
      routes.app.invoices.show.href({ invoiceId }),
    );

    let artifactCount = await db.count(creditNotePdfArtifacts, {
      where: { organization_id: organizationId, credit_note_id: creditNoteId },
    });
    assert.equal(artifactCount, 1);
    let sequence = await db.findOne(documentSequences, {
      where: {
        organization_id: organizationId,
        document_type: 'credit_note',
        financial_year: '26-27',
      },
    });
    assert.equal(sequence?.current_number, 7);

    let pdfPath = routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId });
    let firstResponse = await router.fetch(new URL(pdfPath, 'https://test.invalid'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(firstResponse.status, 200);
    assert.match(firstResponse.headers.get('Content-Disposition') ?? '', /ADJ-26-27-0007\.pdf/);
    let firstBytes = new Uint8Array(await firstResponse.arrayBuffer());
    let issuedPdf = new TextDecoder('latin1').decode(firstBytes);
    assert.doesNotMatch(issuedPdf, /DRAFT/);
    assert.match(issuedPdf, /Credit note no: ADJ\/26-27\/0007/);
    assert.match(issuedPdf, /Original invoice no: INV\//);
    assert.match(issuedPdf, /Service scope reduced/);
    assert.match(issuedPdf, /CGST|IGST|Consulting services/);

    await db.update(invoices, invoiceId, { seller_legal_name: 'Mutated live seller' });
    let secondResponse = await router.fetch(new URL(pdfPath, 'https://test.invalid'), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(secondResponse.status, 200);
    let secondBytes = new Uint8Array(await secondResponse.arrayBuffer());
    assert.deepEqual(Array.from(secondBytes), Array.from(firstBytes));
    assert.doesNotMatch(new TextDecoder('latin1').decode(secondBytes), /Mutated live seller/);

    let duplicateIssue = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      issuePath,
      {},
      sessionCookie,
    );
    assert.equal(duplicateIssue.status, 409);
  });

  it('rolls back numbering and issuance when its immutable PDF cannot be stored', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-finalizer-rollback',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditNoteId = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.5',
      'Retry after PDF failure',
    );
    let finalizerCalled = false;
    let failed = false;
    try {
      await issueCreditNoteDraft(organizationId, invoiceId, creditNoteId, async ({ creditNote }) => {
        finalizerCalled = true;
        assert.equal(creditNote.credit_note_number, 'CN/26-27/0001');
        throw new Error('PDF storage failed');
      });
    } catch (error) {
      failed = error instanceof Error && /PDF storage failed/.test(error.message);
    }
    assert.equal(finalizerCalled, true);
    assert.equal(failed, true);
    assert.equal(
      await db.count(creditNotePdfArtifacts, {
        where: { organization_id: organizationId, credit_note_id: creditNoteId },
      }),
      0,
    );
    assert.equal(
      await db.count(documentSequences, {
        where: {
          organization_id: organizationId,
          document_type: 'credit_note',
          financial_year: '26-27',
        },
      }),
      0,
    );
    let draft = await getHtml(
      router,
      routes.app.invoices.creditNotes.edit.index.href({ invoiceId, creditNoteId }),
      sessionCookie,
    );
    assert.match(draft, /Edit credit note draft/);
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, creditNoteId)).status, 302);
    let issuedPdf = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.match(new TextDecoder('latin1').decode(await issuedPdf.arrayBuffer()), /CN\/26-27\/0001/);
  });

  it('reduces the parent balance and derives Partially Paid and Paid from credits plus payments', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-parent-balance',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let payment = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      routes.app.invoices.payments.record.href({ invoiceId }),
      {
        amount: '4.00',
        payment_date: todayInKolkata(),
        payment_method: 'upi',
        reference: 'PARTIAL-PAYMENT',
      },
      sessionCookie,
    );
    assert.equal(payment.status, 302);

    let firstCredit = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.4',
      'Scope reduced',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, firstCredit)).status, 302);
    let partiallyPaid = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(partiallyPaid, /Status: Partially Paid/);
    assert.match(partiallyPaid, /Amount paid: 4\.00 INR/);
    assert.match(partiallyPaid, /Credited amount: 4\.00 INR/);
    assert.match(partiallyPaid, /Revised total: 6\.00 INR/);
    assert.match(partiallyPaid, /Balance due: 2\.00 INR/);
    assert.match(
      partiallyPaid,
      new RegExp(
        `href="${routes.app.invoices.creditNotes.new.index.href({ invoiceId })}"[^>]*>\\s*Create credit note`,
      ),
    );
    let nextDraft = await getHtml(
      router,
      routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(nextDraft, /name="line_quantity"[^>]*max="0\.6"[^>]*value="0\.6"/);
    let overPayment = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      routes.app.invoices.payments.record.href({ invoiceId }),
      {
        amount: '2.01',
        payment_date: todayInKolkata(),
        payment_method: 'upi',
        reference: 'OVER-REVISED-BALANCE',
      },
      sessionCookie,
    );
    assert.equal(overPayment.status, 400);
    assert.match(await overPayment.text(), /current balance due/i);

    let secondCredit = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.2',
      'Additional scope reduction',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, secondCredit)).status, 302);
    let paid = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(paid, /Status: Paid/);
    assert.match(paid, /Credited amount: 6\.00 INR/);
    assert.match(paid, /Revised total: 4\.00 INR/);
    assert.match(paid, /Balance due: 0\.00 INR/);
    assert.doesNotMatch(paid, /Record a payment/);

    let paidDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'paid' } }),
      sessionCookie,
    );
    assert.match(paidDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));
  });

  it('marks a fully credited invoice Cancelled while retaining its original and credit-note links', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-cancelled',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let creditNoteId = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '1',
      'Full cancellation',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, creditNoteId)).status, 302);

    let parent = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(parent, /Status: Cancelled/);
    assert.match(parent, /Invoice number: INV\//);
    assert.match(parent, /Revised total: 0\.00 INR/);
    assert.match(parent, /Balance due: 0\.00 INR/);
    assert.match(parent, /Credit note CN\/26-27\/0001/);
    assert.match(parent, /Download Credit Note PDF/);
    assert.doesNotMatch(parent, /Create credit note/);

    let cancelledDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'cancelled' } }),
      sessionCookie,
    );
    assert.match(cancelledDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));
    assert.match(cancelledDirectory, /<option value="cancelled" selected/);

    let noRemainingCredit = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.new.index.href({ invoiceId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(noRemainingCredit.status, 409);
  });

  it('rechecks cumulative line and total credit caps atomically before allocating a number', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-credit-cap',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let firstDraft = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.75',
      'First credit',
    );
    let secondDraft = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.75',
      'Second credit',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, firstDraft)).status, 302);

    let rejected = await issueCreditNote(sessionCookie, invoiceId, secondDraft);
    assert.equal(rejected.status, 400);
    assert.match(await rejected.text(), /cannot exceed/i);
    let sequence = await db.findOne(documentSequences, {
      where: {
        organization_id: organizationId,
        document_type: 'credit_note',
        financial_year: '26-27',
      },
    });
    assert.equal(sequence?.current_number, 1, 'a rejected issue must not consume a number');

    let corrected = await submitForm(
      router,
      routes.app.invoices.creditNotes.edit.index.href({
        invoiceId,
        creditNoteId: secondDraft,
      }),
      routes.app.invoices.creditNotes.edit.action.href({
        invoiceId,
        creditNoteId: secondDraft,
      }),
      {
        credit_date: todayInKolkata(),
        reason: 'Second credit corrected',
        line_id: lineId,
        line_quantity: '0.25',
      },
      sessionCookie,
    );
    assert.equal(corrected.status, 302);
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, secondDraft)).status, 302);
    let secondPdf = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({
          invoiceId,
          creditNoteId: secondDraft,
        }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(secondPdf.status, 200);
    assert.match(new TextDecoder('latin1').decode(await secondPdf.arrayBuffer()), /CN\/26-27\/0002/);
    sequence = await db.findOne(documentSequences, {
      where: {
        organization_id: organizationId,
        document_type: 'credit_note',
        financial_year: '26-27',
      },
    });
    assert.equal(sequence?.current_number, 2);
  });

  it('allocates distinct Credit Note numbers for concurrent valid issue actions', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-concurrent-issue',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let first = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.25',
      'Concurrent first',
    );
    let second = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.25',
      'Concurrent second',
    );

    let results = await Promise.all([
      issueCreditNote(sessionCookie, invoiceId, first),
      issueCreditNote(sessionCookie, invoiceId, second),
    ]);
    assert.deepEqual(results.map((response) => response.status), [302, 302]);

    let numbers: string[] = [];
    for (let creditNoteId of [first, second]) {
      let response = await router.fetch(
        new URL(
          routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
          'https://test.invalid',
        ),
        { headers: { Cookie: sessionCookie } },
      );
      let pdf = new TextDecoder('latin1').decode(await response.arrayBuffer());
      let number = /Credit note no: (CN\/26-27\/\d{4})/.exec(pdf)?.[1];
      assert.ok(number);
      numbers.push(number!);
    }
    assert.deepEqual(numbers.sort(), ['CN/26-27/0001', 'CN/26-27/0002']);
  });

  it('allocates independent Credit Note sequences for the Indian financial year boundaries', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-financial-years',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });

    let marchInvoice = await createIssuedInvoice(organizationId, client.id, '2026-03-31');
    let marchCredit = await createCreditNoteDraft(
      sessionCookie,
      marchInvoice.invoiceId,
      marchInvoice.lineId,
      '0.5',
      'March credit',
      '2026-03-31',
    );
    assert.equal(
      (await issueCreditNote(sessionCookie, marchInvoice.invoiceId, marchCredit)).status,
      302,
    );
    let marchPdf = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({
          invoiceId: marchInvoice.invoiceId,
          creditNoteId: marchCredit,
        }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.match(new TextDecoder('latin1').decode(await marchPdf.arrayBuffer()), /CN\/25-26\/0001/);

    let aprilInvoice = await createIssuedInvoice(organizationId, client.id, '2026-04-01');
    let aprilCredit = await createCreditNoteDraft(
      sessionCookie,
      aprilInvoice.invoiceId,
      aprilInvoice.lineId,
      '0.5',
      'April credit',
      '2026-04-01',
    );
    assert.equal(
      (await issueCreditNote(sessionCookie, aprilInvoice.invoiceId, aprilCredit)).status,
      302,
    );
    let aprilPdf = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({
          invoiceId: aprilInvoice.invoiceId,
          creditNoteId: aprilCredit,
        }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.match(new TextDecoder('latin1').decode(await aprilPdf.arrayBuffer()), /CN\/26-27\/0001/);
  });

  it('reverses frozen CGST/SGST, IGST, and manual foreign tax on credited service lines', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-tax-breakdown',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let cases = [
      {
        tax: { mode: 'india_gst', placeOfSupplyStateCode: '27', component: 'intra_state' } as const,
        expected: ['CGST @ 9%', 'SGST @ 9%', '4.50 INR', 'Total tax', '9.00 INR'],
      },
      {
        tax: { mode: 'india_gst', placeOfSupplyStateCode: '29', component: 'inter_state' } as const,
        expected: ['IGST @ 18%', '9.00 INR', 'Total tax'],
      },
      {
        tax: { mode: 'foreign_manual' } as const,
        expected: ['VAT @ 8%', '4.00 INR', 'Total tax'],
      },
    ];

    for (let [index, testCase] of cases.entries()) {
      let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
      await setInvoiceTaxSnapshot(invoiceId, lineId, testCase.tax);
      let creditNoteId = await createCreditNoteDraft(
        sessionCookie,
        invoiceId,
        lineId,
        '0.5',
        `Tax reversal ${index + 1}`,
      );
      let preview = await router.fetch(
        new URL(
          routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
          'https://test.invalid',
        ),
        { headers: { Cookie: sessionCookie } },
      );
      assert.equal(preview.status, 200);
      let pdf = new TextDecoder('latin1').decode(await preview.arrayBuffer());
      for (let expected of testCase.expected) {
        assert.ok(pdf.includes(expected), `${expected} should appear in the Credit Note PDF`);
      }
      assert.match(pdf, /Consulting services/);
      assert.match(pdf, /998314/);
    }
  });

  it('preserves original line discounts, invoice discounts, and round-off on a full credit', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-full-rounding',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    await db.update(invoices, invoiceId, {
      subtotal_minor: 1000,
      line_discount_total_minor: 100,
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '0.5',
      invoice_discount_minor: 50,
      net_subtotal_minor: 850,
      round_off_minor: 25,
      total_minor: 875,
    });
    await db.update(invoiceLines, lineId, {
      discount_mode: 'fixed',
      discount_value: '1',
      line_discount_minor: 100,
      allocated_invoice_discount_minor: 50,
      net_minor: 850,
    });

    let creditNoteId = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '1',
      'Full invoice adjustment',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, creditNoteId)).status, 302);
    let response = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    let pdf = new TextDecoder('latin1').decode(await response.arrayBuffer());
    assert.match(pdf, /Line discounts/);
    assert.match(pdf, /Invoice discount/);
    assert.match(pdf, /Round-off/);
    assert.match(pdf, /8\.75 INR/);
    let parent = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(parent, /Status: Cancelled/);
    assert.match(parent, /Credited amount: 8\.75 INR/);
  });

  it('labels the credited invoice discount with the original percent mode in the Credit Note PDF', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-percent-discount-label',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Percent Discount Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    await db.update(invoices, invoiceId, {
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_mode: 'percent',
      invoice_discount_value: '10',
      invoice_discount_minor: 100,
      net_subtotal_minor: 900,
      round_off_minor: 0,
      total_minor: 900,
    });
    await db.update(invoiceLines, lineId, {
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 100,
      net_minor: 900,
    });

    let creditNoteId = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '1',
      'Full percent credit',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, creditNoteId)).status, 302);
    let response = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({ invoiceId, creditNoteId }),
        'https://test.invalid',
      ),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(response.status, 200);
    let pdf = new TextDecoder('latin1').decode(await response.arrayBuffer());
    assert.match(pdf, /Invoice discount \\\(percent\\\)/);
    assert.doesNotMatch(pdf, /Invoice discount \\\(fixed\\\)/);
  });

  it('lists linked Credit Note numbers beside each invoice in the directory', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'credit-note-directory-links',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Directory Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    let issuedId = await createCreditNoteDraft(
      sessionCookie,
      invoiceId,
      lineId,
      '0.25',
      'Issued note',
    );
    assert.equal((await issueCreditNote(sessionCookie, invoiceId, issuedId)).status, 302);
    await createCreditNoteDraft(sessionCookie, invoiceId, lineId, '0.25', 'Unissued draft');

    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    let entry = new RegExp(`href="/app/invoices/${invoiceId}"[\\s\\S]*?</a>`).exec(directory)?.[0];
    assert.ok(entry, 'the invoice should appear in the directory');
    assert.match(entry!, /Credit notes: CN\/26-27\/0001, Draft/);
    assert.match(entry!, /Balance due: 7\.50 INR/);
  });

  it('scopes Credit Note Drafts, issue actions, and PDFs to the authenticated Organization', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'credit-note-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'credit-note-scope-other');
    let ownerClient = await createClient(owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherClient = await createClient(other.organizationId, {
      type: 'individual',
      legal_name: `Other Credit Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let ownerInvoice = await createIssuedInvoice(owner.organizationId, ownerClient.id);
    let otherInvoice = await createIssuedInvoice(other.organizationId, otherClient.id);
    let ownerDraft = await createCreditNoteDraft(
      owner.sessionCookie,
      ownerInvoice.invoiceId,
      ownerInvoice.lineId,
      '0.5',
      'Owner-only note',
    );
    let otherDraft = await createCreditNoteDraft(
      other.sessionCookie,
      otherInvoice.invoiceId,
      otherInvoice.lineId,
      '0.5',
      'Other-only note',
    );
    assert.equal((await issueCreditNote(owner.sessionCookie, ownerInvoice.invoiceId, ownerDraft)).status, 302);
    let ownerPdfPath = routes.app.invoices.creditNotes.pdf.href({
      invoiceId: ownerInvoice.invoiceId,
      creditNoteId: ownerDraft,
    });
    let ownerPdf = await router.fetch(new URL(ownerPdfPath, 'https://test.invalid'), {
      headers: { Cookie: owner.sessionCookie },
    });
    assert.equal(ownerPdf.status, 200);

    let foreignEdit = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.edit.index.href({
          invoiceId: ownerInvoice.invoiceId,
          creditNoteId: ownerDraft,
        }),
        'https://test.invalid',
      ),
      { headers: { Cookie: other.sessionCookie } },
    );
    assert.equal(foreignEdit.status, 404);
    let foreignPdf = await router.fetch(new URL(ownerPdfPath, 'https://test.invalid'), {
      headers: { Cookie: other.sessionCookie },
    });
    assert.equal(foreignPdf.status, 404);

    let mismatchedParentPdf = await router.fetch(
      new URL(
        routes.app.invoices.creditNotes.pdf.href({
          invoiceId: ownerInvoice.invoiceId,
          creditNoteId: otherDraft,
        }),
        'https://test.invalid',
      ),
      { headers: { Cookie: owner.sessionCookie } },
    );
    assert.equal(mismatchedParentPdf.status, 404);

    let foreignIssue = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: otherInvoice.invoiceId }),
      routes.app.invoices.creditNotes.lifecycle.issue.href({
        invoiceId: ownerInvoice.invoiceId,
        creditNoteId: ownerDraft,
      }),
      {},
      other.sessionCookie,
    );
    assert.equal(foreignIssue.status, 404);
    let foreignDiscard = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: ownerInvoice.invoiceId }),
      routes.app.invoices.creditNotes.lifecycle.discard.href({
        invoiceId: ownerInvoice.invoiceId,
        creditNoteId: otherDraft,
      }),
      {},
      owner.sessionCookie,
    );
    assert.equal(foreignDiscard.status, 404);

    let unchanged = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: ownerInvoice.invoiceId }),
      owner.sessionCookie,
    );
    assert.match(unchanged, /Credit note CN\/26-27\/0001/);
    let otherDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: otherInvoice.invoiceId }),
      other.sessionCookie,
    );
    assert.match(otherDetail, /Credit note Draft/);
    assert.doesNotMatch(otherDetail, /Owner-only note/);
  });
});
