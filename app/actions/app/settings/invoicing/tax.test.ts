import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { organizationInvoicingProfiles } from '../../../../data/db.ts';
import { findInvoicingProfile } from '../../../../data/organization/invoicing.ts';
import { createTestRouter } from '../../../../../test/router.ts';
import { routes } from '../../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, postForm } from '../../../../../test/http.ts';

const { router, db } = await createTestRouter();

const VALID_GSTIN = '27AAPCS2319F1Z5';
const VALID_PAN = 'AAPCS2319F';

function taxFields(overrides: Record<string, string> = {}) {
  return {
    legal_name: 'Acme Studios LLP',
    address_line1: '12 Residency Road',
    address_country: 'IN',
    pan: '',
    gst_registered: '',
    gstin: '',
    gst_state_code: '',
    ...overrides,
  };
}

describe('organization tax registration settings', () => {
  it('saves a normalized PAN and a consistent enabled GST registration', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'tax-save',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({
        pan: '  aapcs2319f  ',
        gst_registered: 'on',
        gstin: '  27aapcs2319f1z5  ',
        gst_state_code: '27',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 302);

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.pan, VALID_PAN, 'PAN is trimmed and uppercased');
    assert.equal(row.gst_registered, true);
    assert.equal(row.gstin, VALID_GSTIN, 'GSTIN is trimmed and uppercased');
    assert.equal(row.gst_state_code, '27');
    assert.equal(row.gst_state_name, 'Maharashtra');

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /<p role="status"[^>]*>Ready to issue invoices<\/p>/);
    assert.match(html, new RegExp(`name="pan"[^>]*value="${VALID_PAN}"`));
    assert.match(html, new RegExp(`name="gstin"[^>]*value="${VALID_GSTIN}"`));
    assert.match(html, /option value="27"[^>]*selected/);
  });

  it('requires a valid PAN and reports it accessibly while preserving the draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'tax-pan-invalid',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({ pan: 'short' }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter a valid 10-character PAN, for example AAPCS2319F\./);
    assert.match(html, /name="pan"[^>]*value="short"/);
    assert.match(html, /name="pan"[^>]*aria-invalid="true"/);
    assert.equal((await findInvoicingProfile(db, organizationId))?.pan ?? null, null);
  });

  it('rejects an invalid GSTIN and preserves the submitted tax values', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'tax-gstin-invalid',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({
        pan: VALID_PAN,
        gst_registered: 'on',
        gstin: '27AAPCS2319F1Z',
        gst_state_code: '27',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(
      html,
      /Enter a 15-character GSTIN, for example 27AAPCS2319F1Z5\./,
    );
    assert.match(html, new RegExp(`name="gstin"[^>]*value="27AAPCS2319F1Z"`));
    assert.match(html, new RegExp(`name="pan"[^>]*value="${VALID_PAN}"`));
    assert.equal(await findInvoicingProfile(db, organizationId), null);
  });

  it('rejects a GSTIN whose state code differs from the selected State/UT', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, db, 'tax-state-mismatch');

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({
        gst_registered: 'on',
        gstin: VALID_GSTIN,
        gst_state_code: '24',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /State or UT code must match the first two digits of the GSTIN\./);
    assert.match(html, /name="gst_state_code"[^>]*aria-invalid="true"/);
  });

  it('rejects a GSTIN whose PAN segment differs from the saved PAN', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, db, 'tax-pan-mismatch');

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({
        pan: 'ABCDE1234F',
        gst_registered: 'on',
        gstin: VALID_GSTIN,
        gst_state_code: '27',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /GSTIN characters 3 to 12 must match the PAN\./);
    assert.match(html, /name="gstin"[^>]*aria-invalid="true"/);
  });

  it('requires a GSTIN and State/UT when GST registration is enabled', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, db, 'tax-required');

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({ gst_registered: 'on' }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Enter a 15-character GSTIN, for example 27AAPCS2319F1Z5\./);
    assert.match(html, /Choose the State or UT for GST registration\./);
  });

  it('clears GSTIN and State/UT and drops the readiness requirement when GST is disabled', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'tax-disable',
    );
    await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({
        pan: VALID_PAN,
        gst_registered: 'on',
        gstin: VALID_GSTIN,
        gst_state_code: '27',
      }),
      sessionCookie,
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({ pan: VALID_PAN, gst_registered: '' }),
      sessionCookie,
    );

    assert.equal(response.status, 302);
    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.gst_registered, false);
    assert.equal(row.gstin, null);
    assert.equal(row.gst_state_code, null);
    assert.equal(row.gst_state_name, null);
    assert.equal(row.pan, VALID_PAN, 'PAN remains when GST is disabled');

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /<p role="status"[^>]*>Ready to issue invoices<\/p>/);
    assert.doesNotMatch(html, new RegExp(`name="gstin"[^>]*value="${VALID_GSTIN}"`));
  });

  it('makes GSTIN and State/UT an issue-readiness requirement while GST is enabled', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'tax-readiness',
    );
    await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      taxFields({ gst_registered: 'on', gstin: VALID_GSTIN, gst_state_code: '27' }),
      sessionCookie,
    );

    // The form and database both require a 15-character GSTIN, so store a syntactically
    // invalid one at the database seam and assert the read model still fails closed.
    await db.update(organizationInvoicingProfiles, organizationId, {
      gstin: 'XXXXXXXXXXXXXXX',
    });

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /<p role="status"[^>]*>Not ready to issue invoices<\/p>/);
    assert.match(html, /<li>GSTIN<\/li>/);
  });
});
