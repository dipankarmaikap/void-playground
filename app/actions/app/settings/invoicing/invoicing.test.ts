import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { APP_NAME } from '../../../../config.ts';
import {
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
} from '../../../../data/db.ts';
import { findInvoicingProfile } from '../../../../data/organization/invoicing.ts';
import { createTestRouter } from '../../../../../test/router.ts';
import { routes } from '../../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  extractCsrf,
  getHtml,
  origin,
  postForm,
} from '../../../../../test/http.ts';

const { router, db } = await createTestRouter();

function invoicingFields(overrides: Record<string, string> = {}) {
  return {
    legal_name: '',
    address_line1: '',
    address_locality: '',
    address_region: '',
    address_postal_code: '',
    address_country: '',
    billing_email: '',
    billing_phone: '',
    ...overrides,
  };
}

describe('organization invoicing settings', () => {
  it('opens Invoicing from Settings with the Organization name as the default seller and incomplete readiness', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-nav',
    );
    let organization = await db.find(organizations, organizationId);
    assert.ok(organization);

    let path = routes.app.settings.invoicing.index.href();
    let html = await getHtml(router, path, sessionCookie);

    assert.match(html, new RegExp(`<title>Invoicing \\| ${APP_NAME}<\\/title>`));
    assert.match(
      html,
      /<nav aria-label="Settings"[\s\S]*?Profile[\s\S]*?Invoicing[\s\S]*?Sessions[\s\S]*?<\/nav>/,
    );
    assert.match(html, new RegExp(`<a[^>]*href="${path}"[^>]*aria-current="page"`));
    assert.match(html, /<main id="main"[\s\S]*?<h1[^>]*>Invoicing<\/h1>/);
    assert.match(html, /Seller legal name[\s\S]*?Not set/);
    assert.ok(html.includes(organization.name));
    assert.match(html, /<p role="status"[^>]*>Not ready to issue invoices<\/p>/);
    assert.match(html, /Business address line 1/);
    assert.match(html, /Business country/);
    assert.match(html, /name="legal_name"[^>]*value=""/);
    assert.match(html, /name="address_line1"[^>]*value=""/);
  });

  it('saves the seller profile and shows the Organization as ready to issue', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-save',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: '  Acme Studios LLP  ',
        address_line1: '  12 Residency Road  ',
        address_locality: 'Bengaluru',
        address_region: 'Karnataka',
        address_postal_code: '560001',
        address_country: ' india ',
        billing_email: ' billing@acme.example ',
        billing_phone: '+91 80 1234 5678',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.app.settings.invoicing.index.href());

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.organization_id, organizationId);
    assert.equal(row.legal_name, 'Acme Studios LLP');
    assert.equal(row.address_line1, '12 Residency Road');
    assert.equal(row.address_locality, 'Bengaluru');
    assert.equal(row.address_region, 'Karnataka');
    assert.equal(row.address_postal_code, '560001');
    assert.equal(row.address_country, 'IN', 'a known country canonicalizes to its ISO code');
    assert.equal(row.billing_email, 'billing@acme.example');
    assert.equal(row.billing_phone, '+91 80 1234 5678');

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /<p role="status"[^>]*>Invoicing settings updated<\/p>/);
    assert.match(html, /<p role="status"[^>]*>Ready to issue invoices<\/p>/);
    assert.match(html, /<dd[^>]*>Acme Studios LLP<\/dd>/);
    assert.match(html, /name="legal_name"[^>]*value="Acme Studios LLP"/);
    assert.match(html, /name="address_line1"[^>]*value="12 Residency Road"/);
    assert.match(html, /name="address_locality"[^>]*value="Bengaluru"/);
    assert.match(html, /name="address_region"[^>]*value="Karnataka"/);
    assert.match(html, /name="address_postal_code"[^>]*value="560001"/);
    assert.match(html, /name="address_country"[^>]*value="India"/);
    assert.match(html, /name="billing_email"[^>]*value="billing@acme.example"/);
    assert.match(html, /name="billing_phone"[^>]*value="\+91 80 1234 5678"/);
  });

  it('updates saved values and falls back to the Organization name when the override is cleared', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-update',
    );
    let organization = await db.find(organizations, organizationId);
    assert.ok(organization);

    let saved = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: 'First Legal Name',
        address_line1: '1 First Street',
        address_country: 'US',
        billing_email: 'first@example.com',
      }),
      sessionCookie,
    );
    assert.equal(saved.status, 302);

    let updated = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: 'Second Legal Name',
        address_line1: '2 Second Street',
        address_country: 'GB',
        billing_email: 'second@example.com',
        billing_phone: '+44 20 7946 0958',
      }),
      sessionCookie,
    );
    assert.equal(updated.status, 302);

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.legal_name, 'Second Legal Name');
    assert.equal(row.address_line1, '2 Second Street');
    assert.equal(row.address_country, 'GB');
    assert.equal(row.billing_email, 'second@example.com');
    assert.equal(row.billing_phone, '+44 20 7946 0958');
    assert.equal(
      (await db.count(organizationInvoicingProfiles, { where: { organization_id: organizationId } })),
      1,
      'updates reuse the single profile row',
    );

    let cleared = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields(),
      sessionCookie,
    );
    assert.equal(cleared.status, 302);

    let clearedRow = await findInvoicingProfile(db, organizationId);
    assert.ok(clearedRow);
    assert.equal(clearedRow.legal_name, null);
    assert.equal(clearedRow.address_line1, null);
    assert.equal(clearedRow.address_country, null);
    assert.equal(clearedRow.billing_email, null);

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /<p role="status"[^>]*>Not ready to issue invoices<\/p>/);
    assert.match(html, /Legal seller name override[\s\S]*?Not set/);
    assert.ok(html.includes(organization.name));
  });

  it('returns accessible 400 feedback and preserves values for an incomplete address', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-partial',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: 'Partial Address Studio',
        address_locality: 'Bengaluru',
        address_postal_code: '560001',
        billing_email: 'partial@example.com',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter business address line 1\./);
    assert.match(html, /Enter a business country\./);
    assert.match(html, /name="address_line1"[^>]*aria-invalid="true"/);
    assert.match(html, /name="address_country"[^>]*aria-invalid="true"/);
    assert.match(html, /name="legal_name"[^>]*value="Partial Address Studio"/);
    assert.match(html, /name="address_locality"[^>]*value="Bengaluru"/);
    assert.match(html, /name="address_postal_code"[^>]*value="560001"/);
    assert.match(html, /name="billing_email"[^>]*value="partial@example.com"/);

    assert.equal(await findInvoicingProfile(db, organizationId), null, 'invalid input is not stored');
    let page = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(page, /<p role="status"[^>]*>Not ready to issue invoices<\/p>/);
    assert.match(page, /name="address_locality"[^>]*value=""/);
  });

  it('rejects invalid and overlong inputs while keeping the submitted draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-invalid',
    );
    let overlongLegalName = 'L'.repeat(121);
    let overlongAddress = 'A'.repeat(201);

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: overlongLegalName,
        address_line1: overlongAddress,
        address_country: 'IN',
        billing_email: 'not-an-email',
        billing_phone: 'call me maybe',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Legal seller name must be 120 characters or fewer\./);
    assert.match(html, /Business address line 1 must be 200 characters or fewer\./);
    assert.match(html, /Enter a valid email address\./);
    assert.match(html, /Enter a valid international phone number/);
    assert.match(html, new RegExp(`name="legal_name"[^>]*value="${overlongLegalName}"`));
    assert.match(html, new RegExp(`name="address_line1"[^>]*value="${overlongAddress}"`));
    assert.match(html, /name="address_country"[^>]*value="IN"/);
    assert.match(html, /name="billing_email"[^>]*value="not-an-email"/);
    assert.match(html, /name="billing_phone"[^>]*value="call me maybe"/);
    assert.match(html, /name="billing_email"[^>]*aria-invalid="true"/);
    assert.equal(await findInvoicingProfile(db, organizationId), null);
  });

  it('keeps stored values when a later edit fails validation', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-stable',
    );
    await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: 'Stable Studio',
        address_line1: '1 Original Street',
        address_country: 'IN',
      }),
      sessionCookie,
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: 'Changed Studio',
        address_line1: '2 Invalid Street',
        address_country: '',
        billing_email: 'invalid',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Enter a business country\./);
    assert.match(html, /name="legal_name"[^>]*value="Changed Studio"/);
    assert.match(html, /name="address_line1"[^>]*value="2 Invalid Street"/);

    let row = await findInvoicingProfile(db, organizationId);
    assert.ok(row);
    assert.equal(row.legal_name, 'Stable Studio');
    assert.equal(row.address_line1, '1 Original Street');
    assert.equal(row.address_country, 'IN');

    let page = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(page, /<p role="status"[^>]*>Ready to issue invoices<\/p>/);
    assert.doesNotMatch(page, /2 Invalid Street/);
  });

  it('keeps each Organization’s profile private and ignores a forged Organization id', async () => {
    let owner = await createUserAndLoginWithOrganization(router, db, 'invoice-owner');
    let other = await createUserAndLoginWithOrganization(router, db, 'invoice-other');
    let secretName = 'Secret Owner Legal LLP';
    let secretAddress = '77 Private Owner Lane';

    let saved = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        legal_name: secretName,
        address_line1: secretAddress,
        address_country: 'GB',
        billing_email: 'owner-billing@example.com',
      }),
      owner.sessionCookie,
    );
    assert.equal(saved.status, 302);

    let otherPage = await getHtml(
      router,
      routes.app.settings.invoicing.index.href(),
      other.sessionCookie,
    );
    assert.doesNotMatch(otherPage, new RegExp(secretName));
    assert.doesNotMatch(otherPage, new RegExp(secretAddress));
    assert.doesNotMatch(otherPage, /owner-billing@example\.com/);
    assert.match(otherPage, /<p role="status"[^>]*>Not ready to issue invoices<\/p>/);

    let forged = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      invoicingFields({
        organization_id: owner.organizationId,
        legal_name: 'Other Legal Name',
        address_line1: '9 Other Street',
        address_country: 'IN',
        billing_email: 'other-billing@example.com',
      }),
      other.sessionCookie,
    );
    assert.equal(forged.status, 302);

    let ownerRow = await findInvoicingProfile(db, owner.organizationId);
    let otherRow = await findInvoicingProfile(db, other.organizationId);
    assert.ok(ownerRow);
    assert.ok(otherRow);
    assert.equal(ownerRow.legal_name, secretName);
    assert.equal(ownerRow.address_line1, secretAddress);
    assert.equal(ownerRow.billing_email, 'owner-billing@example.com');
    assert.equal(otherRow.legal_name, 'Other Legal Name');
    assert.equal(otherRow.address_line1, '9 Other Street');
    assert.equal(otherRow.billing_email, 'other-billing@example.com');

    let ownerAfter = await getHtml(
      router,
      routes.app.settings.invoicing.index.href(),
      owner.sessionCookie,
    );
    assert.match(ownerAfter, new RegExp(secretName));
    assert.doesNotMatch(ownerAfter, /Other Legal Name/);
  });

  it('redirects anonymous requests and rejects missing CSRF tokens', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      db,
      'invoice-anon',
    );

    for (let path of [
      routes.app.settings.invoicing.index.href(),
      routes.app.settings.invoicing.action.href(),
    ]) {
      let response = await router.fetch(new URL(path, origin));
      assert.equal(response.status, 302, `${path} should redirect anonymous requests`);
      let location = new URL(response.headers.get('Location') ?? '', origin);
      assert.equal(location.pathname, routes.auth.login.index.href());
      assert.equal(location.searchParams.get('returnTo'), path);
    }

    let noCsrf = await router.fetch(new URL(routes.app.settings.invoicing.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(
        invoicingFields({ legal_name: 'No Token Studio', address_line1: '1 Token Street' }),
      ).toString(),
    });
    assert.equal(noCsrf.status, 403);
    assert.equal(await findInvoicingProfile(db, organizationId), null);
  });

  it('fails closed for a User without an OrganizationMembership', async () => {
    let tenant = await createUserAndLoginWithOrganization(router, db, 'invoice-no-membership');
    let page = await getHtml(router, routes.app.settings.invoicing.index.href(), tenant.sessionCookie);
    let csrf = extractCsrf(page);
    assert.ok(csrf);

    let membership = await db.findOne(organizationMemberships, {
      where: { organization_id: tenant.organizationId },
    });
    assert.ok(membership);
    await db.delete(organizationMemberships, membership.id);

    let getResponse = await router.fetch(
      new URL(routes.app.settings.invoicing.index.href(), origin),
      { headers: { Cookie: tenant.sessionCookie } },
    );
    assert.equal(getResponse.status, 403);

    let postResponse = await router.fetch(
      new URL(routes.app.settings.invoicing.action.href(), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: tenant.sessionCookie,
        },
        body: new URLSearchParams({
          ...invoicingFields({
            legal_name: 'Membership Required Studio',
            address_line1: '1 Denied Street',
            address_country: 'IN',
          }),
          _csrf: csrf,
        }).toString(),
      },
    );
    assert.equal(postResponse.status, 403);
    assert.equal(await findInvoicingProfile(db, tenant.organizationId), null);
  });
});
