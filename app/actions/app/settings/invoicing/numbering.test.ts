import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { findInvoicingProfile } from '../../../../data/organization-invoicing.ts';
import { router } from '../../../../router.ts';
import { routes } from '../../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, postForm } from '../../../../../test/http.ts';
import { invoicingFormFields } from './test-fields.ts';

let index = routes.app.settings.invoicing.index.href();
let action = routes.app.settings.invoicing.action.href();

describe('organization document numbering settings', () => {
  it('renders the INV and CN prefixes and starting sequence 1 as defaults', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'inv-number-default');
    let html = await getHtml(router, index, sessionCookie);

    assert.match(html, /name="invoice_prefix"[^>]*value="INV"/);
    assert.match(html, /name="invoice_starting_number"[^>]*value="1"/);
    assert.match(html, /name="credit_note_prefix"[^>]*value="CN"/);
    assert.match(html, /name="credit_note_starting_number"[^>]*value="1"/);
    assert.match(html, /Document numbering/);
  });

  it('saves and updates distinct invoice and credit-note series', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-number-save',
    );

    let saved = await postForm(
      router,
      action,
      invoicingFormFields({
        invoice_prefix: ' bill ',
        invoice_starting_number: ' 42 ',
        credit_note_prefix: 'cred',
        credit_note_starting_number: '7',
      }),
      sessionCookie,
    );
    assert.equal(saved.status, 302);

    let row = await findInvoicingProfile(organizationId);
    assert.ok(row);
    assert.equal(row.invoice_prefix, 'BILL');
    assert.equal(row.invoice_starting_number, 42);
    assert.equal(row.credit_note_prefix, 'CRED');
    assert.equal(row.credit_note_starting_number, 7);

    let html = await getHtml(router, index, sessionCookie);
    assert.match(html, /name="invoice_prefix"[^>]*value="BILL"/);
    assert.match(html, /name="invoice_starting_number"[^>]*value="42"/);
    assert.match(html, /name="credit_note_prefix"[^>]*value="CRED"/);
    assert.match(html, /name="credit_note_starting_number"[^>]*value="7"/);
  });

  it('rejects blank, slashed, overlong, and symbol-bearing prefixes with preserved values', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-number-prefix-invalid',
    );
    let cases: Array<[string, string, RegExp]> = [
      ['blank invoice prefix', 'invoice_prefix', /Enter an invoice number prefix\./],
      ['blank credit-note prefix', 'credit_note_prefix', /Enter a credit-note number prefix\./],
      ['slashed prefix', 'invoice_prefix', /Prefixes may contain only letters, digits, hyphens, and underscores\./],
      ['overlong prefix', 'invoice_prefix', /Prefixes must be 12 characters or fewer\./],
      ['symbol prefix', 'credit_note_prefix', /Prefixes may contain only letters, digits, hyphens, and underscores\./],
    ];
    let inputs = [
      '',
      '',
      'INV/26',
      'TOOLONGPREFIX1',
      'CN#1',
    ];

    for (let i = 0; i < cases.length; i++) {
      let [, field, message] = cases[i]!;
      let response = await postForm(
        router,
        action,
        invoicingFormFields({ [field]: inputs[i]! }),
        sessionCookie,
      );
      assert.equal(response.status, 400, cases[i]![0]);
      let html = await response.text();
      assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
      assert.match(html, message, cases[i]![0]);
      assert.match(html, new RegExp(`name="${field}"[^>]*aria-invalid="true"`));
      assert.match(html, new RegExp(`name="${field}"[^>]*value="${inputs[i]!.replace(/[#]/g, '\\#')}"`));
    }
    assert.equal(await findInvoicingProfile(organizationId), null, 'invalid prefixes are not stored');
  });

  it('rejects identical invoice and credit-note prefixes', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-number-same',
    );

    let response = await postForm(
      router,
      action,
      invoicingFormFields({ invoice_prefix: 'SAME', credit_note_prefix: 'same' }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Invoice and credit-note prefixes must be different\./);
    assert.match(html, /name="invoice_prefix"[^>]*value="SAME"/);
    assert.match(html, /name="credit_note_prefix"[^>]*value="same"/);
    assert.equal(await findInvoicingProfile(organizationId), null);
  });

  it('rejects starting sequence numbers below 1 or that are not whole numbers', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-number-floor',
    );

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        invoice_starting_number: '0',
        credit_note_starting_number: '1.5',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Invoice starting sequence must be a positive whole number\./);
    assert.match(html, /Credit-note starting sequence must be a positive whole number\./);
    assert.match(html, /name="invoice_starting_number"[^>]*value="0"/);
    assert.match(html, /name="credit_note_starting_number"[^>]*value="1\.5"/);
    assert.match(html, /name="invoice_starting_number"[^>]*aria-invalid="true"/);
    assert.equal(await findInvoicingProfile(organizationId), null);
  });

  it('keeps numbering settings private and ignores a forged Organization id', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'inv-number-owner');
    let other = await createUserAndLoginWithOrganization(router, 'inv-number-other');

    let saved = await postForm(
      router,
      action,
      invoicingFormFields({
        invoice_prefix: 'SECRET',
        invoice_starting_number: '99',
        credit_note_prefix: 'PRIVATE',
      }),
      owner.sessionCookie,
    );
    assert.equal(saved.status, 302);

    let otherPage = await getHtml(router, index, other.sessionCookie);
    assert.match(otherPage, /name="invoice_prefix"[^>]*value="INV"/);
    assert.doesNotMatch(otherPage, /name="invoice_prefix"[^>]*value="SECRET"/);

    let forged = await postForm(
      router,
      action,
      invoicingFormFields({
        organization_id: owner.organizationId,
        invoice_prefix: 'FORGED',
        credit_note_prefix: 'FAKE',
      }),
      other.sessionCookie,
    );
    assert.equal(forged.status, 302);

    let ownerRow = await findInvoicingProfile(owner.organizationId);
    let otherRow = await findInvoicingProfile(other.organizationId);
    assert.ok(ownerRow);
    assert.ok(otherRow);
    assert.equal(ownerRow.invoice_prefix, 'SECRET');
    assert.equal(ownerRow.invoice_starting_number, 99);
    assert.equal(otherRow.invoice_prefix, 'FORGED');
    assert.equal(otherRow.credit_note_prefix, 'FAKE');
  });

  it('rejects numbering settings changes without a CSRF token', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'inv-number-csrf');
    let page = await getHtml(router, index, sessionCookie);
    assert.ok(page);

    let noCsrf = await router.fetch(new URL(action, 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(
        invoicingFormFields({ invoice_prefix: 'NOCSRF', credit_note_prefix: 'NOPE' }),
      ).toString(),
    });
    assert.equal(noCsrf.status, 403);
  });
});
