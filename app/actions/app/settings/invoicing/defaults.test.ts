import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { findInvoicingProfile } from '../../../../data/organization/invoicing.ts';
import { createTestRouter } from '../../../../../test/router.ts';
import { routes } from '../../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, postForm } from '../../../../../test/http.ts';
import { invoicingFormFields } from './test-fields.ts';

const { router, db } = await createTestRouter();

let index = routes.app.settings.invoicing.index.href();
let action = routes.app.settings.invoicing.action.href();

describe('organization invoicing defaults', () => {
  it('renders INR, Due on receipt, and blank client-visible defaults for a new Organization', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, db, 'inv-default-new');
    let html = await getHtml(router, index, sessionCookie);

    assert.match(html, /name="default_currency"[^>]*value="INR"/);
    assert.match(html, /<option value="due_on_receipt" selected>Due on receipt<\/option>/);
    assert.match(html, /name="payment_instructions"[^>]*value=""|name="payment_instructions"[^>]*><\/textarea>/);
    assert.match(html, /name="customer_notes"/);
    assert.match(html, /Default currency/);
    assert.match(html, /Default payment terms/);
    assert.match(html, /Payment instructions/);
    assert.match(html, /Customer notes/);
  });

  it('saves and renders default currency, payment terms, instructions, and notes', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'inv-default-save',
    );

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        default_currency: ' usd ',
        payment_term: 'net_30',
        payment_instructions: 'Transfer to ACME bank, IFSC ACME0001',
        customer_notes: 'Thank you for your business.',
      }),
      sessionCookie,
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), index);

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.default_currency, 'USD', 'currency normalizes to uppercase');
    assert.equal(row.payment_term, 'net_30');
    assert.equal(row.payment_instructions, 'Transfer to ACME bank, IFSC ACME0001');
    assert.equal(row.customer_notes, 'Thank you for your business.');

    let html = await getHtml(router, index, sessionCookie);
    assert.match(html, /name="default_currency"[^>]*value="USD"/);
    assert.match(html, /<option value="net_30" selected>Net 30<\/option>/);
    assert.match(html, /Transfer to ACME bank, IFSC ACME0001/);
    assert.match(html, /Thank you for your business\./);
  });

  it('accepts and renders the valid ISO 4217 currency XAF', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(
      router,
      db,
      'inv-default-xaf',
    );

    let response = await postForm(
      router,
      action,
      invoicingFormFields({ default_currency: 'xaf' }),
      sessionCookie,
    );
    assert.equal(response.status, 302);

    let html = await getHtml(router, index, sessionCookie);
    assert.match(html, /name="default_currency"[^>]*value="XAF"/);
  });

  it('updates and clears the client-visible defaults', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'inv-default-update',
    );
    let saved = await postForm(
      router,
      action,
      invoicingFormFields({
        default_currency: 'EUR',
        payment_term: 'custom',
        custom_payment_terms: '50% advance, balance on delivery',
        payment_instructions: 'Wire to IBAN DE00',
        customer_notes: 'First note',
      }),
      sessionCookie,
    );
    assert.equal(saved.status, 302);

    let updated = await postForm(
      router,
      action,
      invoicingFormFields({
        default_currency: 'GBP',
        payment_term: 'net_7',
        payment_instructions: '',
        customer_notes: 'Second note',
      }),
      sessionCookie,
    );
    assert.equal(updated.status, 302);

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.default_currency, 'GBP');
    assert.equal(row.payment_term, 'net_7');
    assert.equal(row.custom_payment_terms, null, 'custom terms clear when the term is no longer custom');
    assert.equal(row.payment_instructions, null, 'blank instructions clear');
    assert.equal(row.customer_notes, 'Second note');

    let html = await getHtml(router, index, sessionCookie);
    assert.doesNotMatch(html, /Wire to IBAN DE00/);
    assert.doesNotMatch(html, /50% advance, balance on delivery/);
    assert.match(html, /Second note/);
  });

  it('rejects an invalid currency and an unknown payment term with 400s that preserve values', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'inv-default-invalid',
    );

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        default_currency: 'rupees',
        payment_term: 'net_45',
        payment_instructions: 'Keep my instructions',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /valid 3-letter ISO 4217 currency code/i);
    assert.match(html, /Choose a valid default payment term\./);
    assert.match(html, /name="default_currency"[^>]*value="rupees"/);
    assert.match(html, /name="payment_instructions"[^>]*>Keep my instructions<\/textarea>/);
    assert.match(html, /name="default_currency"[^>]*aria-invalid="true"/);
    assert.match(html, /name="payment_term"[^>]*aria-invalid="true"/);
    assert.equal(await findInvoicingProfile(db, organizationId), null, 'invalid defaults are not stored');

    let unknownCurrency = await postForm(
      router,
      action,
      invoicingFormFields({
        default_currency: 'ZZZ',
        payment_term: 'due_on_receipt',
      }),
      sessionCookie,
    );
    assert.equal(unknownCurrency.status, 400);
    assert.match(await unknownCurrency.text(), /valid 3-letter ISO 4217 currency code/i);
  });

  it('rejects overlong client-visible text without truncating the submitted draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'inv-default-long',
    );
    let longInstructions = 'I'.repeat(1001);
    let longNotes = 'N'.repeat(1001);

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        payment_instructions: longInstructions,
        customer_notes: longNotes,
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Payment instructions must be 1000 characters or fewer\./);
    assert.match(html, /Customer notes must be 1000 characters or fewer\./);
    assert.match(html, new RegExp(`name="payment_instructions"[^>]*>${longInstructions}</textarea>`));
    assert.match(html, new RegExp(`name="customer_notes"[^>]*>${longNotes}</textarea>`));
    assert.equal(await findInvoicingProfile(db, organizationId), null);
  });
});
