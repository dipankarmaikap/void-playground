import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { db, invoices } from '../../../data/db.ts';
import '../../../../test/db-setup.ts';
import { addDays, todayInKolkata } from '../../../data/invoices/dates.ts';
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
  dueDate = addDays(todayInKolkata(), 1),
): Promise<string> {
  let id = crypto.randomUUID();
  await seedInvoice(organizationId, clientId, {
    id,
    recipientName: `Payment Recipient ${id}`,
    invoiceDate: todayInKolkata(),
  });
  await db.update(invoices, id, {
    status: 'issued',
    invoice_number: `PAY/${id}`,
    issued_at: Date.now(),
    seller_legal_name: 'Payment Test Seller',
    seller_address_line1: '1 Seller Road',
    seller_country: 'IN',
    due_date: dueDate,
  });
  return id;
}

async function recordPayment(
  sessionCookie: string,
  invoiceId: string,
  fields: Record<string, string>,
): Promise<Response> {
  return submitForm(
    router,
    routes.app.invoices.show.href({ invoiceId }),
    routes.app.invoices.payments.record.href({ invoiceId }),
    fields,
    sessionCookie,
  );
}

function voidActionFrom(html: string): { action: string; paymentId: string } {
  let match = /<form\b[^>]*action="([^"]+\/payments\/([^/"?]+)\/void)"/.exec(html);
  assert.ok(match, 'an active payment should have a void action');
  return { action: match![1]!, paymentId: match![2]! };
}

describe('invoice payments', () => {
  it('records a partial offline payment and shows its remaining balance as Partially Paid', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-partial',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createIssuedInvoice(organizationId, client.id, todayInKolkata());
    let paymentForm = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    for (let method of [
      'Cash',
      'UPI',
      'Card',
      'Cheque / Demand Draft',
      'Bank Transfer (NEFT/RTGS/IMPS)',
      'International Wire / Remittance',
      'Other',
    ]) {
      assert.ok(paymentForm.includes(method), `${method} should be available`);
    }
    assert.match(paymentForm, /Amount received \(INR\)/);
    assert.match(paymentForm, /name="amount"/);

    let response = await recordPayment(sessionCookie, invoiceId, {
      amount: '4.00',
      payment_date: todayInKolkata(),
      payment_method: 'upi',
      reference: 'UPI-REF-123',
    });

    assert.equal(response.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(detail, /Status: Partially Paid/);
    assert.match(detail, /Amount paid: 4\.00 INR/);
    assert.match(detail, /Balance due: 6\.00 INR/);
    assert.match(detail, /UPI-REF-123/);

    let partiallyPaidDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'partially_paid' } }),
      sessionCookie,
    );
    assert.match(partiallyPaidDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));

    let remainingPayment = await recordPayment(sessionCookie, invoiceId, {
      amount: '6.00',
      payment_date: todayInKolkata(),
      payment_method: 'bank_transfer',
      reference: 'BANK-REF-456',
    });
    assert.equal(remainingPayment.status, 302);
    let paidDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(paidDetail, /Status: Paid/);
    assert.match(paidDetail, /Amount paid: 10\.00 INR/);
    assert.match(paidDetail, /Balance due: 0\.00 INR/);
    assert.doesNotMatch(paidDetail, /Record a payment/);

    let paidDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'paid' } }),
      sessionCookie,
    );
    assert.match(paidDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));
    assert.match(paidDirectory, /<option value="paid" selected/);
  });

  it('keeps Overdue ahead of Partially Paid after the due date', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-overdue',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Overdue Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createIssuedInvoice(
      organizationId,
      client.id,
      addDays(todayInKolkata(), -1),
    );

    let response = await recordPayment(sessionCookie, invoiceId, {
      amount: '4.00',
      payment_date: todayInKolkata(),
      payment_method: 'cash',
      reference: '',
    });

    assert.equal(response.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(detail, /Status: Overdue/);
    assert.doesNotMatch(detail, /Status: Partially Paid/);

    let overdueDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'overdue' } }),
      sessionCookie,
    );
    let partiallyPaidDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'partially_paid' } }),
      sessionCookie,
    );
    assert.match(overdueDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));
    assert.doesNotMatch(partiallyPaidDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));

    let settlement = await recordPayment(sessionCookie, invoiceId, {
      amount: '6.00',
      payment_date: todayInKolkata(),
      payment_method: 'bank_transfer',
      reference: '',
    });
    assert.equal(settlement.status, 302);
    let paidDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(paidDetail, /Status: Paid/);
    assert.doesNotMatch(paidDetail, /Status: Overdue/);
  });

  it('accepts payment amounts at the invoice currency precision', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-currency',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Currency Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createIssuedInvoice(organizationId, client.id);
    await db.update(invoices, invoiceId, { currency: 'JPY' });

    let fractionalMinorUnit = await recordPayment(sessionCookie, invoiceId, {
      amount: '1.5',
      payment_date: todayInKolkata(),
      payment_method: 'other',
      reference: '',
    });
    assert.equal(fractionalMinorUnit.status, 400);

    let validPayment = await recordPayment(sessionCookie, invoiceId, {
      amount: '500',
      payment_date: todayInKolkata(),
      payment_method: 'other',
      reference: '',
    });
    assert.equal(validPayment.status, 302);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie);
    assert.match(detail, /Currency: JPY/);
    assert.match(detail, /Amount paid: 500 JPY/);
    assert.match(detail, /Balance due: 500 JPY/);
    assert.match(detail, /Amount: 500 JPY/);
  });

  it('does not accept concurrent payments that together exceed the balance due', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-concurrent',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Concurrent Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createIssuedInvoice(organizationId, client.id);
    let fields = {
      amount: '6.00',
      payment_date: todayInKolkata(),
      payment_method: 'upi',
      reference: '',
    };

    let responses = await Promise.all([
      recordPayment(sessionCookie, invoiceId, fields),
      recordPayment(sessionCookie, invoiceId, fields),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort((first, second) => first - second),
      [302, 400],
    );
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId }), sessionCookie);
    assert.match(detail, /Amount paid: 6\.00 INR/);
    assert.match(detail, /Balance due: 4\.00 INR/);
  });

  it('requires a reason to void a payment and preserves the void audit history', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-void',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Void Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createIssuedInvoice(organizationId, client.id);
    assert.equal(
      (
        await recordPayment(sessionCookie, invoiceId, {
          amount: '4.00',
          payment_date: todayInKolkata(),
          payment_method: 'card',
          reference: 'CARD-REF-789',
        })
      ).status,
      302,
    );
    let showPath = routes.app.invoices.show.href({ invoiceId });
    let detail = await getHtml(router, showPath, sessionCookie);
    let voidAction = voidActionFrom(detail);

    let missingReason = await submitForm(
      router,
      showPath,
      voidAction.action,
      { reason: ' \t ' },
      sessionCookie,
    );
    assert.equal(missingReason.status, 400);
    assert.match(await missingReason.text(), /Enter a reason for voiding this payment/);

    let voided = await submitForm(
      router,
      showPath,
      voidAction.action,
      { reason: 'Duplicate entry' },
      sessionCookie,
    );
    assert.equal(voided.status, 302);

    let afterVoid = await getHtml(router, showPath, sessionCookie);
    assert.match(afterVoid, /Status: Sent/);
    assert.match(afterVoid, /Amount paid: 0\.00 INR/);
    assert.match(afterVoid, /Balance due: 10\.00 INR/);
    assert.match(afterVoid, /Amount: 4\.00 INR/);
    assert.match(afterVoid, /CARD-REF-789/);
    assert.match(afterVoid, /Voided on:/);
    assert.match(afterVoid, /Void reason: Duplicate entry/);
    assert.doesNotMatch(afterVoid, /Void payment/);
    let sentDirectory = await getHtml(
      router,
      routes.app.invoices.index.href({}, { searchParams: { status: 'sent' } }),
      sessionCookie,
    );
    assert.match(sentDirectory, new RegExp(`href="/app/invoices/${invoiceId}"`));
  });

  it('rejects invalid, excessive, and Draft invoice payments', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-payment-rejections',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Rejected Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let issuedInvoiceId = await createIssuedInvoice(organizationId, client.id);
    let today = todayInKolkata();
    let invalidPayments = [
      { amount: '0', payment_date: today, payment_method: 'cash', reference: '' },
      { amount: '-1', payment_date: today, payment_method: 'cash', reference: '' },
      { amount: '10.01', payment_date: today, payment_method: 'cash', reference: '' },
      { amount: '1.001', payment_date: today, payment_method: 'cash', reference: '' },
      { amount: '1.00', payment_date: today, payment_method: 'cryptocurrency', reference: '' },
      { amount: '1.00', payment_date: '2026-02-30', payment_method: 'cash', reference: '' },
    ];
    for (let fields of invalidPayments) {
      let response = await recordPayment(sessionCookie, issuedInvoiceId, fields);
      assert.equal(response.status, 400, `${fields.amount} / ${fields.payment_method} should be rejected`);
    }

    let issuedDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: issuedInvoiceId }),
      sessionCookie,
    );
    assert.match(issuedDetail, /Status: Sent/);
    assert.match(issuedDetail, /No payments recorded/);

    let draftInvoiceId = crypto.randomUUID();
    await seedInvoice(organizationId, client.id, {
      id: draftInvoiceId,
      recipientName: `Draft Payment Recipient ${draftInvoiceId}`,
      invoiceDate: today,
    });
    let draftResponse = await recordPayment(sessionCookie, draftInvoiceId, {
      amount: '1.00',
      payment_date: today,
      payment_method: 'cash',
      reference: '',
    });
    assert.equal(draftResponse.status, 400);
    assert.match(await draftResponse.text(), /Payments can be recorded only for issued invoices/);
  });

  it('scopes payment recording and voiding to the authenticated Organization', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'invoice-payment-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-payment-scope-other');
    let ownerClient = await createClient(db, owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherClient = await createClient(db, other.organizationId, {
      type: 'individual',
      legal_name: `Other Payment Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let ownerInvoiceId = await createIssuedInvoice(owner.organizationId, ownerClient.id);
    let otherInvoiceId = await createIssuedInvoice(other.organizationId, otherClient.id);
    let paymentFields = {
      amount: '4.00',
      payment_date: todayInKolkata(),
      payment_method: 'upi',
      reference: '',
    };
    assert.equal((await recordPayment(owner.sessionCookie, ownerInvoiceId, paymentFields)).status, 302);
    assert.equal((await recordPayment(other.sessionCookie, otherInvoiceId, paymentFields)).status, 302);

    let ownerShowPath = routes.app.invoices.show.href({ invoiceId: ownerInvoiceId });
    let otherShowPath = routes.app.invoices.show.href({ invoiceId: otherInvoiceId });
    let ownerDetail = await getHtml(router, ownerShowPath, owner.sessionCookie);
    let otherDetail = await getHtml(router, otherShowPath, other.sessionCookie);
    let ownerPaymentAction = voidActionFrom(ownerDetail).action;
    let otherPaymentAction = voidActionFrom(otherDetail).action;

    let foreignRecord = await submitForm(
      router,
      ownerShowPath,
      routes.app.invoices.payments.record.href({ invoiceId: otherInvoiceId }),
      paymentFields,
      owner.sessionCookie,
    );
    assert.equal(foreignRecord.status, 404);

    let foreignVoid = await submitForm(
      router,
      ownerShowPath,
      otherPaymentAction,
      { reason: 'Cross-Organization request' },
      owner.sessionCookie,
    );
    assert.equal(foreignVoid.status, 404);

    let foreignInvoiceVoid = await submitForm(
      router,
      otherShowPath,
      ownerPaymentAction,
      { reason: 'Cross-Organization request' },
      other.sessionCookie,
    );
    assert.equal(foreignInvoiceVoid.status, 404);

    let ownerAfter = await getHtml(router, ownerShowPath, owner.sessionCookie);
    let otherAfter = await getHtml(router, otherShowPath, other.sessionCookie);
    assert.match(ownerAfter, /Amount paid: 4\.00 INR/);
    assert.match(ownerAfter, /Void payment/);
    assert.match(otherAfter, /Amount paid: 4\.00 INR/);
    assert.match(otherAfter, /Void payment/);
  });
});
