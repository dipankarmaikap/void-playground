import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { addDays, todayInKolkata } from '../../../data/invoices/dates.ts';
import { issueDraftInvoice } from '../../../data/invoices/issuance.ts';
import {
  documentSequences,
  invoiceLines,
  invoices,
  organizationInvoicingProfiles,
} from '../../../data/db.ts';
import { testDb as db } from '../../../../test/db-setup.ts';
import { parseInvoiceDraft } from '../../../data/invoices/draft.ts';
import {
  findInvoiceLines,
  updateDraftInvoice,
} from '../../../data/invoices/records.ts';
import {
  parseInvoicingProfile,
  saveInvoicingProfile,
} from '../../../data/organization/invoicing.ts';
import { createAppRouter } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { clientFormValuesOf } from '../clients/form-values.ts';
import { invoicingFormFields } from '../settings/invoicing/test-fields.ts';
import { parseInvoiceFormValues } from './public/schema.ts';
import {
  createUserAndLoginWithOrganization,
  extractCsrf,
  getHtml,
  origin,
  submitForm,
} from '../../../../test/http.ts';
import { markAsSent } from '../../../../test/invoice-fixtures.ts';

const router = createAppRouter({ db });

function draftFields(clientId: string, overrides: Record<string, string> = {}) {
  return {
    client_id: clientId,
    currency: 'INR',
    invoice_date: '2026-04-01',
    due_date: '2026-04-30',
    payment_term: 'custom',
    custom_payment_terms: 'Pay within 29 days',
    recipient_legal_name: 'Issue Recipient',
    recipient_billing_line1: '1 Recipient Street',
    recipient_billing_locality: 'Bengaluru',
    recipient_billing_region: 'Karnataka',
    recipient_billing_postal_code: '560001',
    recipient_billing_country: 'IN',
    recipient_tax_country: '',
    recipient_tax_type: '',
    recipient_tax_value: '',
    recipient_tax_state_code: '',
    payment_instructions: '',
    customer_notes: '',
    internal_note: 'Private issue context',
    line_description: 'Consulting services',
    line_quantity: '1',
    line_unit_price: '100',
    ...overrides,
  };
}

async function createDraft(
  cookie: string,
  clientId: string,
  overrides: Record<string, string> = {},
): Promise<string> {
  let response = await submitForm(
    router,
    routes.app.invoices.new.href({}, { searchParams: { clientId } }),
    routes.app.invoices.create.href(),
    draftFields(clientId, overrides),
    cookie,
  );
  assert.equal(response.status, 302, 'a complete Draft should be created');
  let location = response.headers.get('Location');
  assert.ok(location, 'creation should redirect to the Draft');
  return new URL(location, origin).pathname.split('/').at(-1)!;
}

function invoiceDirectoryPath(params: Record<string, string>): string {
  return routes.app.invoices.index.href({}, { searchParams: params });
}

async function postWithCsrf(
  cookie: string,
  actionPath: string,
  csrf: string,
  fields: Record<string, string> = {},
): Promise<Response> {
  let body = new URLSearchParams({ ...fields, _csrf: csrf });
  return router.fetch(new URL(actionPath, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: body.toString(),
  });
}

function formDataOf(fields: Record<string, string>): FormData {
  let formData = new FormData();
  for (let [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

async function setSellerProfile(
  organizationId: string,
  overrides: Record<string, string> = {},
): Promise<void> {
  let parsed = parseInvoicingProfile({
    legal_name: 'Northstar Services Pvt Ltd',
    address_line1: '12 Seller Road',
    address_locality: 'Mumbai',
    address_region: 'Maharashtra',
    address_postal_code: '400001',
    address_country: 'IN',
    billing_email: 'billing@example.com',
    billing_phone: '+919876543210',
    pan: 'AAPCS2319F',
    gst_registered: 'on',
    gstin: '27AAPCS2319F1Z5',
    gst_state_code: '27',
    default_currency: 'INR',
    payment_term: 'due_on_receipt',
    custom_payment_terms: '',
    payment_instructions: 'Pay by bank transfer',
    customer_notes: '',
    invoice_prefix: 'NS',
    invoice_starting_number: '50',
    credit_note_prefix: 'CN',
    credit_note_starting_number: '1',
    logo: 'data:image/png;base64,aGVsbG8=',
    signature_image: 'data:image/png;base64,aGVsbG8=',
    signatory_name: 'Asha Seller',
    signatory_designation: 'Director',
    ...overrides,
  });
  assert.equal(parsed.ok, true, 'the test seller profile should be valid');
  if (parsed.ok) await saveInvoicingProfile(db, organizationId, parsed.value);
}

describe('invoice issue flow', () => {
  it('offers Mark as sent and leaves an invalid Draft unnumbered when seller details are incomplete', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-incomplete-seller',
    );
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Issue Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id);
    let showPath = routes.app.invoices.show.href({ invoiceId });
    let issueAction = routes.app.invoices.lifecycle.issue.href({ invoiceId });
    let detail = await getHtml(router, showPath, sessionCookie);

    assert.match(detail, /Mark as sent/);
    assert.match(detail, new RegExp(`action="${issueAction}"`));

    let noCsrf = await router.fetch(new URL(issueAction, origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: '',
    });
    assert.equal(noCsrf.status, 403);

    let response = await submitForm(router, showPath, issueAction, {}, sessionCookie);
    assert.equal(response.status, 400);
    let issueHtml = await response.text();
    assert.match(issueHtml, /Business address line 1/i);
    assert.match(issueHtml, /business country/i);

    let invoice = await db.find(invoices, invoiceId);
    assert.equal(invoice?.status, 'draft');
    assert.equal(invoice?.invoice_number, null);
    assert.ok(extractCsrf(detail), 'the Draft detail page should provide a CSRF token');
  });

  it('validates recipient address, applicable GST identifiers, and saved service lines before numbering', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-recipient-gates',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Recipient Gate Client ${crypto.randomUUID()}`,
      status: 'active',
    });

    let missingAddressId = await createDraft(sessionCookie, client.id, {
      recipient_billing_line1: '',
      recipient_billing_country: '',
      due_date: '2099-12-31',
    });
    let missingAddress = await markAsSent(sessionCookie, missingAddressId);
    assert.equal(missingAddress.status, 400);
    let missingAddressHtml = await missingAddress.text();
    assert.match(missingAddressHtml, /recipient billing address line 1/i);
    assert.match(missingAddressHtml, /recipient billing country/i);
    assert.equal((await db.find(invoices, missingAddressId))?.invoice_number, null);

    let applicableGstId = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'domestic',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: 'on',
      recipient_tax_country: 'IN',
      recipient_tax_type: 'gstin',
      recipient_tax_value: '27AAPCS2319F1Z5',
      recipient_tax_state_code: '27',
      line_tax_treatment: 'taxable',
      line_gst_rate: '18',
      due_date: '2099-12-31',
    });
    await db.update(invoices, applicableGstId, { recipient_tax_value: null });
    let invalidRecipientGst = await markAsSent(sessionCookie, applicableGstId);
    assert.equal(invalidRecipientGst.status, 400);
    assert.match(await invalidRecipientGst.text(), /valid recipient GSTIN or UIN/i);
    assert.equal((await db.find(invoices, applicableGstId))?.invoice_number, null);

    let missingLineId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    await db.deleteMany(invoiceLines, {
      where: { organization_id: organizationId, invoice_id: missingLineId },
    });
    let missingLine = await markAsSent(sessionCookie, missingLineId);
    assert.equal(missingLine.status, 400);
    assert.match(await missingLine.text(), /at least one valid service line/i);
    assert.equal((await db.find(invoices, missingLineId))?.invoice_number, null);
    assert.equal(
      await db.count(documentSequences, {
        where: {
          organization_id: organizationId,
          document_type: 'invoice',
          financial_year: '26-27',
        },
      }),
      0,
      'failed validations must not consume a sequence number',
    );
  });

  it('rechecks seller GSTIN and State/UT readiness at issue time', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-seller-gst-gates',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Seller GST Gate Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invalidGstinId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    await db.update(organizationInvoicingProfiles, organizationId, {
      gstin: '000000000000000',
    });
    let invalidGstin = await markAsSent(sessionCookie, invalidGstinId);
    assert.equal(invalidGstin.status, 400);
    assert.match(await invalidGstin.text(), /valid seller GSTIN/i);
    assert.equal((await db.find(invoices, invalidGstinId))?.invoice_number, null);

    await db.update(organizationInvoicingProfiles, organizationId, {
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '99',
    });
    let invalidStateId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    let invalidState = await markAsSent(sessionCookie, invalidStateId);
    assert.equal(invalidState.status, 400);
    assert.match(await invalidState.text(), /valid GST State\/UT/i);
    assert.equal((await db.find(invoices, invalidStateId))?.invoice_number, null);
  });

  it('accepts a valid recipient UIN when it is marked applicable', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-valid-uin',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `UIN Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'domestic',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: 'on',
      recipient_tax_country: 'IN',
      recipient_tax_type: 'uin',
      recipient_tax_value: '123456789012345',
      line_tax_treatment: 'taxable',
      line_gst_rate: '18',
      due_date: '2099-12-31',
    });

    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);
    let issued = await db.find(invoices, invoiceId);
    assert.equal(issued?.status, 'issued');
    assert.equal(issued?.recipient_tax_type, 'uin');
    assert.equal(issued?.recipient_tax_value, '123456789012345');
  });

  it('issues a valid Draft with an FY number and seller snapshots', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-snapshot',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: 'Original Client Profile',
      billing_line1: 'Original Client Address',
      billing_country: 'IN',
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    let showPath = routes.app.invoices.show.href({ invoiceId });

    let response = await markAsSent(sessionCookie, invoiceId);
    assert.equal(response.status, 302);

    let issued = await db.find(invoices, invoiceId);
    assert.equal(issued?.status, 'issued');
    assert.equal(issued?.invoice_number, 'NS/26-27/0050');
    assert.ok(typeof issued?.issued_at === 'number');
    assert.equal(issued?.seller_legal_name, 'Northstar Services Pvt Ltd');
    assert.equal(issued?.seller_address_line1, '12 Seller Road');
    assert.equal(issued?.seller_country, 'IN');
    assert.equal(issued?.seller_email, 'billing@example.com');
    assert.equal(issued?.seller_phone, '+919876543210');
    assert.equal(issued?.seller_pan, 'AAPCS2319F');
    assert.equal(issued?.seller_gst_registered, true);
    assert.equal(issued?.seller_gstin, '27AAPCS2319F1Z5');
    assert.equal(issued?.seller_gst_state_code, '27');
    assert.equal(issued?.seller_gst_state_name, 'Maharashtra');
    assert.equal(issued?.seller_logo_data_url, 'data:image/png;base64,aGVsbG8=');
    assert.equal(issued?.seller_signature_data_url, 'data:image/png;base64,aGVsbG8=');
    assert.equal(issued?.seller_signatory_name, 'Asha Seller');
    assert.equal(issued?.seller_signatory_designation, 'Director');
    assert.equal(issued?.recipient_legal_name, 'Issue Recipient');
    assert.equal(issued?.recipient_billing_line1, '1 Recipient Street');

    let detail = await getHtml(router, showPath, sessionCookie);
    assert.match(detail, /Status: Sent/);
    assert.match(detail, /Invoice number: NS\/26-27\/0050/);
    assert.match(detail, /Seller snapshot/);
    assert.match(detail, /Northstar Services Pvt Ltd/);
    assert.doesNotMatch(detail, /Edit draft|Discard draft|Mark as sent/);
    assert.match(detail, /name="internal_note"/);
  });

  it('defaults the seller legal name to the Organization name until it is overridden', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-default-legal-name',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Default Legal Name Client ${crypto.randomUUID()}`,
      status: 'active',
    });

    // No Invoicing-settings override: the profile legal name is cleared so issue must fall back to
    // the Organization name (spec #30).
    await db.update(organizationInvoicingProfiles, organizationId, { legal_name: null });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);

    let issued = await db.find(invoices, invoiceId);
    assert.equal(issued?.seller_legal_name, `Test Organization ${organizationId}`);
  });

  it('derives Sent and Overdue at Kolkata date boundaries and filters/searches issued numbers', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-status',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Status Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let today = todayInKolkata();
    let dueDates = [addDays(today, -1), today, addDays(today, 1)];
    let invoiceIds: string[] = [];

    for (let dueDate of dueDates) {
      let invoiceId = await createDraft(sessionCookie, client.id, {
        invoice_date: dueDate,
        due_date: dueDate,
      });
      invoiceIds.push(invoiceId);
      let issued = await markAsSent(sessionCookie, invoiceId);
      assert.equal(issued.status, 302);
      let detail = await getHtml(
        router,
        routes.app.invoices.show.href({ invoiceId }),
        sessionCookie,
      );
      assert.match(detail, dueDate < today ? /Status: Overdue/ : /Status: Sent/);
    }

    let overdue = await getHtml(
      router,
      invoiceDirectoryPath({ status: 'overdue' }),
      sessionCookie,
    );
    let sent = await getHtml(router, invoiceDirectoryPath({ status: 'sent' }), sessionCookie);
    assert.match(overdue, /<option value="overdue" selected/);
    assert.match(sent, /<option value="sent" selected/);
    assert.deepEqual(
      invoiceIds.filter((id) => overdue.includes(`/app/invoices/${id}`)),
      [invoiceIds[0]],
    );
    assert.deepEqual(
      invoiceIds.filter((id) => sent.includes(`/app/invoices/${id}`)),
      invoiceIds.slice(1),
    );

    let overdueInvoice = await db.find(invoices, invoiceIds[0]!);
    assert.ok(overdueInvoice?.invoice_number);
    let numberSearch = await getHtml(
      router,
      invoiceDirectoryPath({ q: overdueInvoice.invoice_number }),
      sessionCookie,
    );
    assert.ok(numberSearch.includes(`/app/invoices/${invoiceIds[0]}`));
    assert.ok(!numberSearch.includes(`/app/invoices/${invoiceIds[1]}`));
  });

  it('allocates independent Indian FY sequences with custom prefixes and floors only on issue', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-issue-sequence-first');
    await setSellerProfile(first.organizationId, {
      invoice_prefix: 'FY',
      invoice_starting_number: '50',
    });
    let firstClient = await createClient(db, first.organizationId, {
      type: 'individual',
      legal_name: `Sequence Client ${crypto.randomUUID()}`,
      status: 'active',
    });

    let abandonedId = await createDraft(first.sessionCookie, firstClient.id, {
      invoice_date: '2026-03-30',
      due_date: '2026-03-30',
    });
    assert.equal((await db.find(invoices, abandonedId))?.invoice_number, null);
    let abandoned = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: abandonedId }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: abandonedId }),
      {},
      first.sessionCookie,
    );
    assert.equal(abandoned.status, 302);
    assert.equal(
      await db.count(documentSequences, {
        where: {
          organization_id: first.organizationId,
          document_type: 'invoice',
          financial_year: '25-26',
        },
      }),
      0,
      'an abandoned Draft must not create a sequence row',
    );

    let marchId = await createDraft(first.sessionCookie, firstClient.id, {
      invoice_date: '2026-03-31',
      due_date: '2026-04-30',
    });
    assert.equal((await markAsSent(first.sessionCookie, marchId)).status, 302);
    assert.equal((await db.find(invoices, marchId))?.invoice_number, 'FY/25-26/0050');

    let aprilId = await createDraft(first.sessionCookie, firstClient.id, {
      invoice_date: '2026-04-01',
      due_date: '2026-04-30',
    });
    assert.equal((await markAsSent(first.sessionCookie, aprilId)).status, 302);
    assert.equal((await db.find(invoices, aprilId))?.invoice_number, 'FY/26-27/0050');

    let discardIssued = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: aprilId }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: aprilId }),
      {},
      first.sessionCookie,
    );
    assert.equal(discardIssued.status, 409);
    assert.equal((await db.find(invoices, aprilId))?.invoice_number, 'FY/26-27/0050');

    let mayId = await createDraft(first.sessionCookie, firstClient.id, {
      invoice_date: '2026-05-01',
      due_date: '2026-05-30',
    });
    assert.equal((await markAsSent(first.sessionCookie, mayId)).status, 302);
    assert.equal((await db.find(invoices, mayId))?.invoice_number, 'FY/26-27/0051');

    let second = await createUserAndLoginWithOrganization(router, 'invoice-issue-sequence-second');
    await setSellerProfile(second.organizationId, {
      invoice_prefix: 'ALT',
      invoice_starting_number: '7',
    });
    let secondClient = await createClient(db, second.organizationId, {
      type: 'individual',
      legal_name: `Other Sequence Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherId = await createDraft(second.sessionCookie, secondClient.id, {
      invoice_date: '2026-04-15',
      due_date: '2026-04-30',
    });
    assert.equal((await markAsSent(second.sessionCookie, otherId)).status, 302);
    assert.equal((await db.find(invoices, otherId))?.invoice_number, 'ALT/26-27/0007');
  });

  it('atomically assigns distinct invoice numbers to concurrent issue actions', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-concurrent',
    );
    await setSellerProfile(organizationId, {
      invoice_prefix: 'PAR',
      invoice_starting_number: '1',
    });
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Concurrent Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let firstId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    let secondId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });

    let responses = await Promise.all([
      markAsSent(sessionCookie, firstId),
      markAsSent(sessionCookie, secondId),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status),
      [302, 302],
    );
    let numbers = [
      (await db.find(invoices, firstId))?.invoice_number,
      (await db.find(invoices, secondId))?.invoice_number,
    ].sort();
    assert.deepEqual(numbers, ['PAR/26-27/0001', 'PAR/26-27/0002']);

    let duplicateIssueId = await createDraft(sessionCookie, client.id, {
      due_date: '2099-12-31',
    });
    let duplicateResponses = await Promise.all([
      markAsSent(sessionCookie, duplicateIssueId),
      markAsSent(sessionCookie, duplicateIssueId),
    ]);
    assert.deepEqual(
      duplicateResponses.map((response) => response.status).sort((a, b) => a - b),
      [302, 409],
    );
    assert.equal(
      (await db.find(invoices, duplicateIssueId))?.invoice_number,
      'PAR/26-27/0003',
    );
    let sequence = await db.findOne(documentSequences, {
      where: {
        organization_id: organizationId,
        document_type: 'invoice',
        financial_year: '26-27',
      },
    });
    assert.equal(sequence?.current_number, 3, 'a duplicate issue attempt must not consume a number');
  });

  it('rolls numbering back when the in-transaction issued-artifact finalizer fails', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-finalizer-rollback',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Finalizer Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    let finalizerCalled = false;
    let failed = false;

    try {
      await issueDraftInvoice(db, organizationId, invoiceId, async ({ invoice, lines }) => {
        finalizerCalled = true;
        assert.equal(invoice.status, 'issued');
        assert.equal(invoice.invoice_number, 'NS/26-27/0050');
        assert.equal(lines.length, 1);
        assert.equal(Object.keys(invoice).includes('internal_note'), false);
        throw new Error('issued artifact could not be persisted');
      });
    } catch (error) {
      failed = error instanceof Error && /artifact could not be persisted/.test(error.message);
    }

    assert.equal(finalizerCalled, true);
    assert.equal(failed, true);
    assert.equal((await db.find(invoices, invoiceId))?.status, 'draft');
    assert.equal((await db.find(invoices, invoiceId))?.invoice_number, null);
    assert.equal(
      await db.count(documentSequences, {
        where: {
          organization_id: organizationId,
          document_type: 'invoice',
          financial_year: '26-27',
        },
      }),
      0,
    );
    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);
    assert.equal((await db.find(invoices, invoiceId))?.invoice_number, 'NS/26-27/0050');
  });

  it('keeps seller and recipient snapshots unchanged after Settings and Client profile edits', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-preserved-snapshot',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: 'Client Before Issue',
      billing_line1: 'Client Profile Address',
      billing_country: 'IN',
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: '27AAPCS2319F1Z5',
      tax_state_code: '27',
      tax_state_name: 'Maharashtra',
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, {
      due_date: '2099-12-31',
      recipient_legal_name: 'Recipient Snapshot Name',
      recipient_billing_line1: 'Recipient Snapshot Address',
      recipient_billing_locality: 'Pune',
      recipient_billing_region: 'Maharashtra',
      recipient_billing_country: 'IN',
      recipient_tax_country: 'IN',
      recipient_tax_type: 'gstin',
      recipient_tax_value: '27AAPCS2319F1Z5',
      recipient_tax_state_code: '27',
    });
    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);

    let settingsUpdate = await submitForm(
      router,
      routes.app.settings.invoicing.index.href(),
      routes.app.settings.invoicing.action.href(),
      invoicingFormFields({
        legal_name: 'Replacement Seller Ltd',
        address_line1: '99 Replacement Road',
        address_locality: 'Seattle',
        address_region: 'Washington',
        address_postal_code: '98101',
        address_country: 'US',
        billing_email: 'updated@example.com',
        billing_phone: '+12065550100',
        gst_registered: '',
        gstin: '',
        gst_state_code: '',
        invoice_prefix: 'UPDATED',
        invoice_starting_number: '1',
        logo: 'data:image/png;base64,bmV3',
        signature_image: 'data:image/png;base64,bmV3',
        signatory_name: 'Replacement Signatory',
      }),
      sessionCookie,
    );
    assert.equal(settingsUpdate.status, 302);
    let clientUpdate = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: client.id }),
      routes.app.clients.update.href({ clientId: client.id }),
      {
        _method: 'PUT',
        ...clientFormValuesOf(client),
        legal_name: 'Client After Issue',
        billing_line1: 'Changed Client Address',
        billing_country: 'US',
        tax_country: '',
        tax_type: '',
        tax_value: '',
        tax_state_code: '',
      },
      sessionCookie,
    );
    assert.equal(clientUpdate.status, 302);

    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    let issued = await db.find(invoices, invoiceId);
    assert.equal(issued?.seller_legal_name, 'Northstar Services Pvt Ltd');
    assert.equal(issued?.seller_address_line1, '12 Seller Road');
    assert.equal(issued?.seller_gstin, '27AAPCS2319F1Z5');
    assert.equal(issued?.seller_logo_data_url, 'data:image/png;base64,aGVsbG8=');
    assert.equal(issued?.recipient_legal_name, 'Recipient Snapshot Name');
    assert.equal(issued?.recipient_billing_line1, 'Recipient Snapshot Address');
    assert.equal(issued?.recipient_tax_value, '27AAPCS2319F1Z5');
    assert.match(detail, /Northstar Services Pvt Ltd/);
    assert.match(detail, /12 Seller Road/);
    assert.match(detail, /Recipient Snapshot Name/);
    assert.match(detail, /Recipient Snapshot Address/);
    assert.match(detail, /Tax identifier: GSTIN 27AAPCS2319F1Z5/);
    assert.doesNotMatch(detail, /Replacement Seller Ltd|Replacement Road|Client After Issue|Changed Client Address/);
  });

  it('rejects issued edit and discard requests while allowing only the private note update', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-issue-immutable',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Immutable Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });
    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);
    let showPath = routes.app.invoices.show.href({ invoiceId });
    let before = await db.find(invoices, invoiceId);
    let beforeLines = await findInvoiceLines(db, organizationId, invoiceId);
    assert.ok(before);

    let editPage = await router.fetch(new URL(
      routes.app.invoices.edit.href({ invoiceId }),
      origin,
    ), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(editPage.status, 409);
    let attemptedEdit = await submitForm(
      router,
      showPath,
      routes.app.invoices.update.href({ invoiceId }),
      {
        _method: 'PUT',
        ...draftFields(client.id),
        recipient_legal_name: 'Attempted overwrite',
        line_description: 'Attempted replacement line',
      },
      sessionCookie,
    );
    assert.equal(attemptedEdit.status, 409);
    let attemptedDiscard = await submitForm(
      router,
      showPath,
      routes.app.invoices.lifecycle.discard.href({ invoiceId }),
      {},
      sessionCookie,
    );
    assert.equal(attemptedDiscard.status, 409);
    let rejectedInvoice = await db.find(invoices, invoiceId);
    assert.equal(rejectedInvoice?.recipient_legal_name, before.recipient_legal_name);
    assert.equal(rejectedInvoice?.invoice_number, before.invoice_number);
    assert.equal(rejectedInvoice?.updated_at, before.updated_at);

    let { values } = parseInvoiceFormValues(formDataOf(draftFields(client.id)));
    let parsed = parseInvoiceDraft(values);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      let directEdit = await updateDraftInvoice(db, organizationId, invoiceId, parsed.value);
      assert.equal(directEdit, null, 'the stale Draft update must not mutate an issued invoice');
    }
    assert.deepEqual(await findInvoiceLines(db, organizationId, invoiceId), beforeLines);

    let noCsrf = await router.fetch(
      new URL(routes.app.invoices.lifecycle.internalNote.href({ invoiceId }), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({ internal_note: 'No token' }),
      },
    );
    assert.equal(noCsrf.status, 403);

    let noteUpdate = await submitForm(
      router,
      showPath,
      routes.app.invoices.lifecycle.internalNote.href({ invoiceId }),
      {
        internal_note: 'Follow up after client call',
        recipient_legal_name: 'Attempted note-side overwrite',
        invoice_date: '2030-01-01',
      },
      sessionCookie,
    );
    assert.equal(noteUpdate.status, 302);
    let after = await db.find(invoices, invoiceId);
    assert.equal(after?.status, 'issued');
    assert.equal(after?.invoice_number, before.invoice_number);
    assert.equal(after?.recipient_legal_name, before.recipient_legal_name);
    assert.equal(after?.invoice_date, before.invoice_date);
    assert.equal(after?.internal_note, 'Follow up after client call');
    assert.deepEqual(await findInvoiceLines(db, organizationId, invoiceId), beforeLines);

    let detail = await getHtml(router, showPath, sessionCookie);
    assert.match(detail, /Follow up after client call/);
    assert.doesNotMatch(detail, /Attempted note-side overwrite|Attempted overwrite/);
  });

  it('scopes issue and internal-note actions to the authenticated Organization', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'invoice-issue-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-issue-scope-other');
    await setSellerProfile(owner.organizationId);
    await setSellerProfile(other.organizationId);
    let ownerClient = await createClient(db, owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Issue Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherClient = await createClient(db, other.organizationId, {
      type: 'individual',
      legal_name: `Other Issue Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let ownerInvoiceId = await createDraft(owner.sessionCookie, ownerClient.id, {
      due_date: '2099-12-31',
    });
    let otherInvoiceId = await createDraft(other.sessionCookie, otherClient.id, {
      due_date: '2099-12-31',
    });
    let ownerShowPath = routes.app.invoices.show.href({ invoiceId: ownerInvoiceId });
    let ownerDetail = await getHtml(router, ownerShowPath, owner.sessionCookie);
    let ownerCsrf = extractCsrf(ownerDetail);
    assert.ok(ownerCsrf);

    let foreignIssue = await postWithCsrf(
      owner.sessionCookie,
      routes.app.invoices.lifecycle.issue.href({ invoiceId: otherInvoiceId }),
      ownerCsrf,
    );
    assert.equal(foreignIssue.status, 404);
    assert.equal((await db.find(invoices, otherInvoiceId))?.status, 'draft');
    assert.equal((await db.find(invoices, otherInvoiceId))?.invoice_number, null);

    assert.equal((await markAsSent(other.sessionCookie, otherInvoiceId)).status, 302);
    let foreignNote = await postWithCsrf(
      owner.sessionCookie,
      routes.app.invoices.lifecycle.internalNote.href({ invoiceId: otherInvoiceId }),
      ownerCsrf,
      { internal_note: 'Cross-Organization overwrite' },
    );
    assert.equal(foreignNote.status, 404);
    assert.equal((await db.find(invoices, otherInvoiceId))?.internal_note, 'Private issue context');
  });
});
