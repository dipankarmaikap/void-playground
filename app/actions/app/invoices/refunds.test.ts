import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { db, invoiceLines, invoicePayments, invoices } from '../../../data/db.ts';
import '../../../../test/db-setup.ts';
import { todayInKolkata } from '../../../data/invoices/dates.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  origin,
  submitForm,
} from '../../../../test/http.ts';
import { seedInvoice } from '../../../../test/invoice-fixtures.ts';

async function createIssuedInvoice(
  organizationId: string,
  clientId: string,
): Promise<{ invoiceId: string; lineId: string }> {
  let invoiceId = crypto.randomUUID();
  let lineId = crypto.randomUUID();
  let now = Date.now();
  await seedInvoice(organizationId, clientId, {
    id: invoiceId,
    recipientName: `Refund Recipient ${invoiceId}`,
    invoiceDate: todayInKolkata(),
  });
  await db.update(invoices, invoiceId, {
    status: 'issued',
    invoice_number: `INV/${invoiceId}`,
    issued_at: now,
    seller_legal_name: 'Refund Test Seller',
    seller_address_line1: '1 Seller Road',
    seller_country: 'IN',
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

async function recordPayment(
  sessionCookie: string,
  invoiceId: string,
  amount: string,
): Promise<Response> {
  return submitForm(
    router,
    routes.app.invoices.show.href({ invoiceId }),
    routes.app.invoices.payments.record.href({ invoiceId }),
    {
      amount,
      payment_date: todayInKolkata(),
      payment_method: 'upi',
      reference: 'PAID-BEFORE-CN',
    },
    sessionCookie,
  );
}

async function issueCreditNote(
  sessionCookie: string,
  invoiceId: string,
  lineId: string,
  quantity: string,
): Promise<void> {
  let created = await submitForm(
    router,
    routes.app.invoices.creditNotes.new.href({ invoiceId }),
    routes.app.invoices.creditNotes.create.href({ invoiceId }),
    {
      credit_date: todayInKolkata(),
      reason: 'Service scope reduced',
      line_id: lineId,
      line_quantity: quantity,
    },
    sessionCookie,
  );
  assert.equal(created.status, 302);
  let location = created.headers.get('Location');
  assert.ok(location);
  let creditNoteId = new URL(location!, 'https://test.invalid').pathname.split('/').at(-2)!;
  let issued = await submitForm(
    router,
    routes.app.invoices.creditNotes.edit.href({ invoiceId, creditNoteId }),
    routes.app.invoices.creditNotes.lifecycle.issue.href({ invoiceId, creditNoteId }),
    {},
    sessionCookie,
  );
  assert.equal(issued.status, 302);
}

async function recordRefund(
  sessionCookie: string,
  invoiceId: string,
  fields: Record<string, string>,
): Promise<Response> {
  return submitForm(
    router,
    routes.app.invoices.show.href({ invoiceId }),
    routes.app.invoices.refunds.record.href({ invoiceId }),
    fields,
    sessionCookie,
  );
}

function voidActionFrom(html: string): { action: string; refundId: string } {
  let match = /<form\b[^>]*action="([^"]+\/refunds\/([^/"?]+)\/void)"/.exec(html);
  assert.ok(match, 'an active refund should have a void action');
  return { action: match![1]!, refundId: match![2]! };
}

function refundFields(amount: string): Record<string, string> {
  return {
    amount,
    refund_date: todayInKolkata(),
    refund_method: 'card',
    reference: 'REFUND-CARD',
  };
}

function paymentVoidActionFrom(html: string, paymentId: string): string {
  let match = new RegExp(
    `<form\\b[^>]*action="([^"]+\\/payments\\/${paymentId}\\/void)"`,
  ).exec(html);
  assert.ok(match, 'the active payment should have a void action');
  return match![1]!;
}

function activePaymentVoidActionFrom(html: string): string {
  let match = /<form\b[^>]*action="([^"]+\/payments\/[^/"?]+\/void)"/.exec(html);
  assert.ok(match, 'an active payment should have a void action');
  return match![1]!;
}

describe('invoice refunds', () => {
  it('surfaces refund due after a post-payment full credit note and records a full refund', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-full',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '1.0000');

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let detail = await getHtml(router, showPath, sessionCookie);
    assert.match(detail, /Status: Cancelled/);
    assert.match(detail, /Revised total: 0\.00 INR/);
    assert.match(detail, /Refund due: 10\.00 INR/);
    assert.match(detail, /name="amount"/);
    assert.match(detail, /Record refund/);

    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /Refund due: 10\.00 INR/);

    let recorded = await recordRefund(sessionCookie, invoiceId, {
      amount: '10.00',
      refund_date: todayInKolkata(),
      refund_method: 'bank_transfer',
      reference: 'REFUND-REF-1',
    });
    assert.equal(recorded.status, 302);

    let afterRefund = await getHtml(router, showPath, sessionCookie);
    assert.match(afterRefund, /Refund due: 0\.00 INR/);
    assert.match(afterRefund, /REFUND-REF-1/);
    assert.match(afterRefund, /Bank Transfer \(NEFT\/RTGS\/IMPS\)/);
    assert.doesNotMatch(afterRefund, /Record refund/);
  });

  it('tracks refund due after a partial post-payment credit note across multiple refunds', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-partial-cn',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Partial Credit Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '0.5000');

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let afterCredit = await getHtml(router, showPath, sessionCookie);
    assert.match(afterCredit, /Status: Paid/);
    assert.match(afterCredit, /Revised total: 5\.00 INR/);
    assert.match(afterCredit, /Refund due: 5\.00 INR/);
    assert.match(afterCredit, /Balance due: 0\.00 INR/);

    let partial = await recordRefund(sessionCookie, invoiceId, refundFields('2.00'));
    assert.equal(partial.status, 302);
    let afterPartial = await getHtml(router, showPath, sessionCookie);
    assert.match(afterPartial, /Refunded: 2\.00 INR/);
    assert.match(afterPartial, /Net paid: 8\.00 INR/);
    assert.match(afterPartial, /Refund due: 3\.00 INR/);
    assert.match(afterPartial, /Amount: 2\.00 INR/);
    assert.match(afterPartial, /Record refund/);

    let remaining = await recordRefund(sessionCookie, invoiceId, {
      ...refundFields('3.00'),
      refund_method: 'upi',
      reference: 'REFUND-UPI',
    });
    assert.equal(remaining.status, 302);
    let afterFull = await getHtml(router, showPath, sessionCookie);
    assert.match(afterFull, /Refunded: 5\.00 INR/);
    assert.match(afterFull, /Refund due: 0\.00 INR/);
    assert.match(afterFull, /REFUND-UPI/);
    assert.doesNotMatch(afterFull, /Record refund/);
  });

  it('rejects over-refunds, refunds without a refund due, invalid entries, and Draft invoices', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-rejections',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Rejected Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '1.0000');

    let overRefund = await recordRefund(sessionCookie, invoiceId, refundFields('10.01'));
    assert.equal(overRefund.status, 400);
    assert.match(await overRefund.text(), /Refund cannot exceed the current refund due amount/);
    for (let fields of [
      refundFields('0'),
      { ...refundFields('1.00'), refund_date: '2026-02-30' },
      { ...refundFields('1.00'), refund_method: 'cryptocurrency' },
      { ...refundFields('1.001') },
    ]) {
      assert.equal((await recordRefund(sessionCookie, invoiceId, fields)).status, 400);
    }
    let showPath = routes.app.invoices.show.href({ invoiceId });
    let stillDue = await getHtml(router, showPath, sessionCookie);
    assert.match(stillDue, /Refund due: 10\.00 INR/);
    assert.match(stillDue, /No refunds recorded/);

    assert.equal((await recordRefund(sessionCookie, invoiceId, refundFields('10.00'))).status, 302);
    let noRefundDue = await recordRefund(sessionCookie, invoiceId, refundFields('1.00'));
    assert.equal(noRefundDue.status, 400);
    assert.match(await noRefundDue.text(), /There is no refund due on this invoice/);

    let draftId = crypto.randomUUID();
    await seedInvoice(organizationId, client.id, {
      id: draftId,
      recipientName: `Draft Refund Recipient ${draftId}`,
      invoiceDate: todayInKolkata(),
    });
    let draftResponse = await recordRefund(sessionCookie, draftId, refundFields('1.00'));
    assert.equal(draftResponse.status, 400);
    assert.match(await draftResponse.text(), /Refunds can be recorded only for issued invoices/);
  });

  it('rejects voiding the only payment after a full credit and refund', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-payment-void-invariant',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Payment Void Invariant Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '1.0000');
    assert.equal(
      (
        await recordRefund(sessionCookie, invoiceId, {
          ...refundFields('10.00'),
          reference: 'FULL-CREDIT-REFUND',
        })
      ).status,
      302,
    );

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let beforeVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(beforeVoid, /Status: Cancelled/);
    assert.match(beforeVoid, /Revised total: 0\.00 INR/);
    assert.match(beforeVoid, /Refunded: 10\.00 INR/);
    assert.match(beforeVoid, /Net paid: 0\.00 INR/);
    assert.match(beforeVoid, /Balance due: 0\.00 INR/);
    assert.match(beforeVoid, /Refund due: 0\.00 INR/);
    let paymentVoidAction = activePaymentVoidActionFrom(beforeVoid);

    let rejected = await submitForm(
      router,
      showPath,
      paymentVoidAction,
      { _method: 'DELETE', reason: 'Reverse the original receipt' },
      sessionCookie,
    );
    assert.equal(rejected.status, 400);
    let rejectionHtml = await rejected.text();
    assert.match(
      rejectionHtml,
      /role="alert"[^>]*>This payment cannot be voided because active refunds would exceed the remaining active payments\./,
    );
    assert.match(rejectionHtml, /name="reason"[^>]*aria-invalid="true"/);
    let describedError = /<textarea\b[^>]*name="reason"[^>]*aria-describedby="([^"]+)"/.exec(
      rejectionHtml,
    );
    assert.ok(describedError, 'the reason field should describe its error');
    assert.match(rejectionHtml, new RegExp(`<p id="${describedError![1]}" role="alert"`));

    let afterRejectedVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(afterRejectedVoid, /Status: Cancelled/);
    assert.match(afterRejectedVoid, /Amount paid: 10\.00 INR/);
    assert.match(afterRejectedVoid, /Revised total: 0\.00 INR/);
    assert.match(afterRejectedVoid, /Balance due: 0\.00 INR/);
    assert.match(afterRejectedVoid, /Refunded: 10\.00 INR/);
    assert.match(afterRejectedVoid, /Net paid: 0\.00 INR/);
    assert.match(afterRejectedVoid, /Refund due: 0\.00 INR/);
    assert.ok(
      afterRejectedVoid.includes(paymentVoidAction),
      'the active payment should remain in the auditable payment history',
    );
    assert.match(afterRejectedVoid, /Reference: PAID-BEFORE-CN/);
    assert.match(afterRejectedVoid, /Reference: FULL-CREDIT-REFUND/);
    assert.doesNotMatch(afterRejectedVoid, /Voided on:/);
  });

  it('derives status from net paid when gross payments and net paid diverge after a refund and a payment void', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-net-paid-status',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Net Paid Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '6.00')).status, 302);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '2.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '0.5000');
    assert.equal((await recordRefund(sessionCookie, invoiceId, refundFields('3.00'))).status, 302);

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let beforeVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(beforeVoid, /Status: Paid/);
    assert.match(beforeVoid, /Net paid: 5\.00 INR/);

    // Voiding the 2.00 payment leaves 6.00 of gross payments but only 3.00 of net paid. Gross
    // payments still cover the 5.00 revised total, but net paid does not, so status and balance
    // due must follow the net-paid equation rather than the gross payment total.
    let voidedPayment = await db.findOne(invoicePayments, {
      where: { organization_id: organizationId, invoice_id: invoiceId, amount_minor: 200 },
    });
    assert.ok(voidedPayment);
    let voidAction = paymentVoidActionFrom(beforeVoid, voidedPayment!.id);
    let voided = await submitForm(
      router,
      showPath,
      voidAction,
      { _method: 'DELETE', reason: 'Duplicate receipt' },
      sessionCookie,
    );
    assert.equal(voided.status, 302);

    let afterVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(afterVoid, /Status: Partially Paid/);
    assert.match(afterVoid, /Balance due: 2\.00 INR/);
    assert.match(afterVoid, /Net paid: 3\.00 INR/);
    assert.match(afterVoid, /Refunded: 3\.00 INR/);

    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(
      directory,
      new RegExp(
        `href="/app/invoices/${invoiceId}"[\\s\\S]*?Partially Paid[\\s\\S]*?Balance due: 2\\.00 INR`,
      ),
    );
  });

  it('voids a refund with a reason, restoring refund due while retaining the audit history', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-void',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Void Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '1.0000');
    assert.equal((await recordRefund(sessionCookie, invoiceId, refundFields('10.00'))).status, 302);

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let detail = await getHtml(router, showPath, sessionCookie);
    let voidAction = voidActionFrom(detail);

    let missingReason = await submitForm(
      router,
      showPath,
      voidAction.action,
      { _method: 'DELETE', reason: ' \t ' },
      sessionCookie,
    );
    assert.equal(missingReason.status, 400);
    assert.match(await missingReason.text(), /Enter a reason for voiding this refund/);

    let voided = await submitForm(
      router,
      showPath,
      voidAction.action,
      { _method: 'DELETE', reason: 'Refund sent to the wrong account' },
      sessionCookie,
    );
    assert.equal(voided.status, 302);

    let afterVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(afterVoid, /Refund due: 10\.00 INR/);
    assert.match(afterVoid, /Refunded: 0\.00 INR/);
    assert.match(afterVoid, /Amount: 10\.00 INR/);
    assert.match(afterVoid, /REFUND-CARD/);
    assert.match(afterVoid, /Voided on:/);
    assert.match(afterVoid, /Void reason: Refund sent to the wrong account/);
    assert.doesNotMatch(afterVoid, /Void refund/);
    assert.match(afterVoid, /Record refund/);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /Refund due: 10\.00 INR/);

    let alreadyVoided = await submitForm(
      router,
      showPath,
      voidAction.action,
      { _method: 'DELETE', reason: 'Second attempt' },
      sessionCookie,
    );
    assert.equal(alreadyVoided.status, 409);
  });

  it('restores refund due and keeps balances consistent when a refund is voided', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-void-balances',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Void Balance Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '0.5000');

    let showPath = routes.app.invoices.show.href({ invoiceId });
    let beforeRefund = await getHtml(router, showPath, sessionCookie);
    assert.match(beforeRefund, /Revised total: 5\.00 INR/);
    assert.match(beforeRefund, /Net paid: 10\.00 INR/);
    assert.match(beforeRefund, /Refund due: 5\.00 INR/);
    assert.match(beforeRefund, /Balance due: 0\.00 INR/);

    assert.equal((await recordRefund(sessionCookie, invoiceId, refundFields('5.00'))).status, 302);
    let afterRefund = await getHtml(router, showPath, sessionCookie);
    assert.match(afterRefund, /Refunded: 5\.00 INR/);
    assert.match(afterRefund, /Net paid: 5\.00 INR/);
    assert.match(afterRefund, /Refund due: 0\.00 INR/);
    assert.match(afterRefund, /Balance due: 0\.00 INR/);

    let voidAction = voidActionFrom(afterRefund).action;
    let voided = await submitForm(
      router,
      showPath,
      voidAction,
      { _method: 'DELETE', reason: 'Refund reversed by the bank' },
      sessionCookie,
    );
    assert.equal(voided.status, 302);

    let afterVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(afterVoid, /Refunded: 0\.00 INR/);
    assert.match(afterVoid, /Net paid: 10\.00 INR/);
    assert.match(afterVoid, /Refund due: 5\.00 INR/);
    assert.match(afterVoid, /Balance due: 0\.00 INR/);
    assert.match(afterVoid, /Status: Paid/);
  });

  it('scopes refund recording, voiding, and views to the authenticated Organization', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'invoice-refund-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-refund-scope-other');
    let ownerClient = await createClient(owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherClient = await createClient(other.organizationId, {
      type: 'individual',
      legal_name: `Other Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let ownerInvoice = await createIssuedInvoice(owner.organizationId, ownerClient.id);
    let otherInvoice = await createIssuedInvoice(other.organizationId, otherClient.id);
    assert.equal((await recordPayment(owner.sessionCookie, ownerInvoice.invoiceId, '10.00')).status, 302);
    assert.equal((await recordPayment(other.sessionCookie, otherInvoice.invoiceId, '10.00')).status, 302);
    await issueCreditNote(owner.sessionCookie, ownerInvoice.invoiceId, ownerInvoice.lineId, '1.0000');
    await issueCreditNote(other.sessionCookie, otherInvoice.invoiceId, otherInvoice.lineId, '1.0000');
    assert.equal(
      (await recordRefund(owner.sessionCookie, ownerInvoice.invoiceId, refundFields('10.00'))).status,
      302,
    );
    assert.equal(
      (await recordRefund(other.sessionCookie, otherInvoice.invoiceId, refundFields('10.00'))).status,
      302,
    );

    let ownerShowPath = routes.app.invoices.show.href({ invoiceId: ownerInvoice.invoiceId });
    let otherShowPath = routes.app.invoices.show.href({ invoiceId: otherInvoice.invoiceId });
    let ownerVoid = voidActionFrom(await getHtml(router, ownerShowPath, owner.sessionCookie));
    let otherVoid = voidActionFrom(await getHtml(router, otherShowPath, other.sessionCookie));

    let foreignRecord = await submitForm(
      router,
      ownerShowPath,
      routes.app.invoices.refunds.record.href({ invoiceId: otherInvoice.invoiceId }),
      refundFields('1.00'),
      owner.sessionCookie,
    );
    assert.equal(foreignRecord.status, 404);

    let foreignVoid = await submitForm(
      router,
      ownerShowPath,
      otherVoid.action,
      { _method: 'DELETE', reason: 'Cross-Organization request' },
      owner.sessionCookie,
    );
    assert.equal(foreignVoid.status, 404);

    let foreignInvoiceVoid = await submitForm(
      router,
      otherShowPath,
      ownerVoid.action,
      { _method: 'DELETE', reason: 'Cross-Organization request' },
      other.sessionCookie,
    );
    assert.equal(foreignInvoiceVoid.status, 404);

    let foreignShow = await router.fetch(new URL(otherShowPath, origin), {
      headers: { Cookie: owner.sessionCookie },
    });
    assert.equal(foreignShow.status, 404);

    let ownerDirectory = await getHtml(router, routes.app.invoices.index.href(), owner.sessionCookie);
    let otherDirectory = await getHtml(router, routes.app.invoices.index.href(), other.sessionCookie);
    assert.doesNotMatch(ownerDirectory, new RegExp(`href="/app/invoices/${otherInvoice.invoiceId}"`));
    assert.doesNotMatch(otherDirectory, new RegExp(`href="/app/invoices/${ownerInvoice.invoiceId}"`));
    assert.doesNotMatch(ownerDirectory, /Refund due:/);
  });

  it('rejects refund mutations without a CSRF token', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-refund-csrf',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Csrf Refund Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let { invoiceId, lineId } = await createIssuedInvoice(organizationId, client.id);
    assert.equal((await recordPayment(sessionCookie, invoiceId, '10.00')).status, 302);
    await issueCreditNote(sessionCookie, invoiceId, lineId, '1.0000');
    assert.equal((await recordRefund(sessionCookie, invoiceId, refundFields('10.00'))).status, 302);
    let voidAction = voidActionFrom(
      await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie),
    );

    for (let action of [
      routes.app.invoices.refunds.record.href({ invoiceId }),
      voidAction.action,
    ]) {
      let response = await router.fetch(new URL(action, origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams(refundFields('1.00')).toString(),
      });
      assert.equal(response.status, 403);
    }
    let after = await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie);
    assert.match(after, /Refunded: 10\.00 INR/);
    assert.match(after, /Refund due: 0\.00 INR/);
  });
});
