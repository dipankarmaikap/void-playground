import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import {
  documentSequences,
  invoicePdfArtifacts,
  invoices,
  organizationInvoicingProfiles,
} from '../../../data/db.ts';
import { testDb as db } from '../../../../test/db-setup.ts';
import {
  parseInvoicingProfile,
  saveInvoicingProfile,
} from '../../../data/organization/invoicing.ts';
import { createAppRouter } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { clientFormValuesOf } from '../clients/form-values.ts';
import { invoicingFormFields } from '../settings/invoicing/test-fields.ts';
import {
  createUserAndLoginWithOrganization,
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
    recipient_legal_name: 'Pdf Recipient',
    recipient_billing_line1: '1 Recipient Street',
    recipient_billing_locality: 'Bengaluru',
    recipient_billing_region: 'Karnataka',
    recipient_billing_postal_code: '560001',
    recipient_billing_country: 'IN',
    recipient_tax_country: '',
    recipient_tax_type: '',
    recipient_tax_value: '',
    recipient_tax_state_code: '',
    payment_instructions: 'Pay by bank transfer to the details below.',
    customer_notes: 'Thank you for your business.',
    internal_note: 'Private note that must never reach a PDF',
    line_description: 'Consulting services',
    line_sac: '998314',
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
    routes.app.invoices.new.index.href({}, { searchParams: { clientId } }),
    routes.app.invoices.new.action.href(),
    draftFields(clientId, overrides),
    cookie,
  );
  assert.equal(response.status, 302, 'a complete Draft should be created');
  let location = response.headers.get('Location');
  assert.ok(location, 'creation should redirect to the Draft');
  return new URL(location, origin).pathname.split('/').at(-1)!;
}

async function fetchPdf(cookie: string | undefined, invoiceId: string): Promise<Response> {
  let url = new URL(routes.app.invoices.pdf.href({ invoiceId }), origin);
  return router.fetch(url, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

async function pdfBody(response: Response): Promise<string> {
  let bytes = new Uint8Array(await response.arrayBuffer());
  return new TextDecoder('latin1').decode(bytes);
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

describe('invoice PDF downloads', () => {
  it('previews a Draft PDF with a DRAFT watermark and no allocated number, without mutation', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-pdf-draft-preview',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Draft Pdf Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, {
      line_unit_price: '100.50',
    });
    let before = await db.find(invoices, invoiceId);
    assert.ok(before);

    let response = await fetchPdf(sessionCookie, invoiceId);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/pdf');
    let disposition = response.headers.get('Content-Disposition') ?? '';
    assert.match(disposition, /inline;\s*filename="invoice-draft\.pdf"/);

    let bytes = new Uint8Array(await response.arrayBuffer());
    let text = new TextDecoder('latin1').decode(bytes);
    assert.equal(text.slice(0, 5), '%PDF-', 'the response must start with PDF bytes');
    assert.match(text, /DRAFT/);
    assert.match(text, /Northstar Services Pvt Ltd/);
    assert.match(text, /12 Seller Road/);
    assert.match(text, /Pdf Recipient/);
    assert.match(text, /1 Recipient Street/);
    assert.match(text, /Consulting services/);
    assert.match(text, /998314/);
    assert.match(text, /100\.50 INR/);
    assert.match(text, /Invoice no: DRAFT/);
    assert.match(text, /Rupees One Hundred and Paise Fifty Only/);
    assert.match(text, /Pay within 29 days/);
    assert.match(text, /Pay by bank transfer to the details below\./);
    assert.match(text, /Thank you for your business\./);

    let after = await db.find(invoices, invoiceId);
    assert.equal(after?.status, 'draft');
    assert.equal(after?.invoice_number, null);
    assert.equal(after?.updated_at, before.updated_at, 'a preview must not mutate the Draft');
    assert.equal(
      await db.count(documentSequences, {
        where: { organization_id: organizationId, document_type: 'invoice' },
      }),
      0,
      'a preview must not allocate an invoice number',
    );
  });

  it('omits the private internal note from Draft and issued PDFs', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-pdf-internal-note',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Internal Note Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });

    let draftPdf = await pdfBody(await fetchPdf(sessionCookie, invoiceId));
    assert.doesNotMatch(draftPdf, /Private note that must never reach a PDF/);

    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);
    let showPath = routes.app.invoices.show.href({ invoiceId });
    let noteUpdate = await submitForm(
      router,
      showPath,
      routes.app.invoices.lifecycle.internalNote.href({ invoiceId }),
      { internal_note: 'Secret INTERNAL follow-up marker' },
      sessionCookie,
    );
    assert.equal(noteUpdate.status, 302);
    let issuedPdf = await pdfBody(await fetchPdf(sessionCookie, invoiceId));
    assert.doesNotMatch(issuedPdf, /Secret INTERNAL follow-up marker/);
    assert.doesNotMatch(issuedPdf, /Private note that must never reach a PDF/);
  });

  it('stores the issued PDF at issue time and returns the exact bytes after Settings and Client edits', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-pdf-issued-immutability',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Immutability Client ${crypto.randomUUID()}`,
      billing_line1: 'Client Address Before Issue',
      billing_country: 'IN',
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });

    let beforeIssue = await db.count(invoicePdfArtifacts, {
      where: { organization_id: organizationId, invoice_id: invoiceId },
    });
    assert.equal(beforeIssue, 0, 'a Draft must not have a stored PDF artifact');

    let issueResponse = await markAsSent(sessionCookie, invoiceId);
    assert.equal(issueResponse.status, 302);
    let issuedNumber = (await db.find(invoices, invoiceId))?.invoice_number;
    assert.equal(issuedNumber, 'NS/26-27/0050');
    assert.equal(
      await db.count(invoicePdfArtifacts, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
      }),
      1,
      'issuing must store exactly one PDF artifact',
    );

    let first = await fetchPdf(sessionCookie, invoiceId);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('Content-Type'), 'application/pdf');
    let disposition = first.headers.get('Content-Disposition') ?? '';
    assert.match(disposition, /filename="NS-26-27-0050\.pdf"/);
    let firstBytes = new Uint8Array(await first.arrayBuffer());

    let firstText = new TextDecoder('latin1').decode(firstBytes);
    assert.equal(firstText.slice(0, 5), '%PDF-');
    assert.doesNotMatch(firstText, /DRAFT/);
    assert.match(firstText, /Invoice no: NS\/26-27\/0050/);
    assert.match(firstText, /Northstar Services Pvt Ltd/);
    assert.match(firstText, /Rupees One Hundred Only/);

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
        gst_registered: '',
        gstin: '',
        gst_state_code: '',
        logo: 'data:image/png;base64,bmV3',
        signature_image: 'data:image/png;base64,bmV3',
        signatory_name: 'Replacement Signatory',
      }),
      sessionCookie,
    );
    assert.equal(settingsUpdate.status, 302);
    let clientUpdate = await submitForm(
      router,
      routes.app.clients.edit.index.href({ clientId: client.id }),
      routes.app.clients.edit.action.href({ clientId: client.id }),
      {
        ...clientFormValuesOf(client),
        legal_name: 'Client After Issue',
        billing_line1: 'Changed Client Address',
        billing_country: 'US',
      },
      sessionCookie,
    );
    assert.equal(clientUpdate.status, 302);

    let second = await fetchPdf(sessionCookie, invoiceId);
    assert.equal(second.status, 200);
    let secondBytes = new Uint8Array(await second.arrayBuffer());
    assert.deepEqual(
      Array.from(secondBytes),
      Array.from(firstBytes),
      'an issued PDF must return the exact stored bytes',
    );
    let secondText = new TextDecoder('latin1').decode(secondBytes);
    assert.match(secondText, /Northstar Services Pvt Ltd/);
    assert.match(secondText, /12 Seller Road/);
    assert.doesNotMatch(secondText, /Replacement Seller Ltd|99 Replacement Road/);
  });

  it('shows the accessible PDF download link on Draft and issued detail pages', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-pdf-detail-link',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Link Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, { due_date: '2099-12-31' });

    let draftDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(draftDetail, new RegExp(`href="${routes.app.invoices.pdf.href({ invoiceId })}"`));
    assert.match(draftDetail, /Download PDF/);

    assert.equal((await markAsSent(sessionCookie, invoiceId)).status, 302);
    let issuedDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId }),
      sessionCookie,
    );
    assert.match(issuedDetail, new RegExp(`href="${routes.app.invoices.pdf.href({ invoiceId })}"`));
    assert.match(issuedDetail, /Download PDF/);
  });

  it('keeps PDF downloads authenticated and Organization-scoped with 404 for foreign invoices', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'invoice-pdf-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-pdf-scope-other');
    await setSellerProfile(owner.organizationId);
    await setSellerProfile(other.organizationId);
    let ownerClient = await createClient(db, owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Pdf Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let otherClient = await createClient(db, other.organizationId, {
      type: 'individual',
      legal_name: `Other Pdf Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let ownerDraftId = await createDraft(owner.sessionCookie, ownerClient.id, {
      due_date: '2099-12-31',
    });
    let otherDraftId = await createDraft(other.sessionCookie, otherClient.id, {
      due_date: '2099-12-31',
    });

    let unauthenticated = await fetchPdf(undefined, ownerDraftId);
    assert.equal(unauthenticated.status, 302, 'an anonymous PDF request must not see the document');

    let foreignDraft = await fetchPdf(owner.sessionCookie, otherDraftId);
    assert.equal(foreignDraft.status, 404);

    assert.equal((await markAsSent(other.sessionCookie, otherDraftId)).status, 302);
    let foreignIssued = await fetchPdf(owner.sessionCookie, otherDraftId);
    assert.equal(foreignIssued.status, 404);
    assert.equal(
      await db.count(invoicePdfArtifacts, {
        where: { organization_id: other.organizationId, invoice_id: otherDraftId },
      }),
      1,
      'the other Organization keeps its own artifact',
    );

    let ownIssued = await fetchPdf(other.sessionCookie, otherDraftId);
    assert.equal(ownIssued.status, 200);

    let missingId = crypto.randomUUID();
    assert.equal((await fetchPdf(owner.sessionCookie, missingId)).status, 404);

    await db.update(organizationInvoicingProfiles, other.organizationId, { legal_name: null });
    assert.equal((await db.find(invoices, otherDraftId))?.seller_legal_name, 'Northstar Services Pvt Ltd');
    assert.equal(
      await db.count(invoicePdfArtifacts, {
        where: { organization_id: owner.organizationId, invoice_id: ownerDraftId },
      }),
      0,
      'a foreign artifact is never created for another Organization',
    );
  });

  it('renders international amount-in-words for non-INR drafts', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-pdf-usd-words',
    );
    await setSellerProfile(organizationId);
    let client = await createClient(db, organizationId, {
      type: 'individual',
      legal_name: `Usd Client ${crypto.randomUUID()}`,
      status: 'active',
    });
    let invoiceId = await createDraft(sessionCookie, client.id, {
      currency: 'USD',
      line_quantity: '2',
      line_unit_price: '75.05',
    });
    let pdf = await pdfBody(await fetchPdf(sessionCookie, invoiceId));
    assert.match(pdf, /One Hundred Fifty and 10\/100 US Dollar Only/);
  });
});
