import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { findInvoicingProfile } from '../../../../data/organization-invoicing.ts';
import { router } from '../../../../router.ts';
import { routes } from '../../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, postForm } from '../../../../../test/http.ts';
import { invoicingFormFields } from './test-fields.ts';

let index = routes.app.settings.invoicing.index.href();
let action = routes.app.settings.invoicing.action.href();

function imageDataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

let logo = imageDataUrl('image/png', Buffer.from('a small png payload'));
let newLogo = imageDataUrl('image/webp', Buffer.from('a replacement webp payload'));
let signature = imageDataUrl('image/jpeg', Buffer.from('a small jpeg signature'));

describe('organization logo and authorized signature settings', () => {
  it('starts with no logo or signature image', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'inv-image-default');
    let html = await getHtml(router, index, sessionCookie);

    assert.match(html, /name="logo"[^>]*value=""/);
    assert.match(html, /name="signature_image"[^>]*value=""/);
    assert.match(html, /Organization logo/);
    assert.match(html, /Authorized signature/);
  });

  it('saves, renders, and replaces the logo, signature, and signatory details', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-image-save',
    );

    let saved = await postForm(
      router,
      action,
      invoicingFormFields({
        logo,
        signature_image: signature,
        signatory_name: ' Jane Doe ',
        signatory_designation: 'Finance Director',
      }),
      sessionCookie,
    );
    assert.equal(saved.status, 302);

    let row = await findInvoicingProfile(organizationId);
    assert.ok(row);
    assert.equal(row.logo_data_url, logo);
    assert.equal(row.signature_data_url, signature);
    assert.equal(row.signatory_name, 'Jane Doe');
    assert.equal(row.signatory_designation, 'Finance Director');

    let html = await getHtml(router, index, sessionCookie);
    assert.ok(html.includes(`src="${logo}"`), 'the saved logo data URL is rendered');
    assert.match(html, /alt="Organization logo"/);
    assert.ok(html.includes(`src="${signature}"`), 'the saved signature data URL is rendered');
    assert.match(html, /alt="Authorized signature"/);
    assert.match(html, /name="signatory_name"[^>]*value="Jane Doe"/);
    assert.match(html, /name="signatory_designation"[^>]*value="Finance Director"/);

    let replaced = await postForm(
      router,
      action,
      invoicingFormFields({
        logo: newLogo,
        signature_image: '',
        signatory_name: 'John Roe',
        signatory_designation: 'Managing Director',
      }),
      sessionCookie,
    );
    assert.equal(replaced.status, 302);

    let replacedRow = await findInvoicingProfile(organizationId);
    assert.ok(replacedRow);
    assert.equal(replacedRow.logo_data_url, newLogo, 'a new data URL replaces the previous logo');
    assert.equal(replacedRow.signature_data_url, signature, 'a blank image field keeps the saved image');
    assert.equal(replacedRow.signatory_name, 'John Roe');
    assert.equal(replacedRow.signatory_designation, 'Managing Director');
  });

  it('removes the logo and signature and clears the signatory block', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-image-remove',
    );
    let saved = await postForm(
      router,
      action,
      invoicingFormFields({
        logo,
        signature_image: signature,
        signatory_name: 'Jane Doe',
        signatory_designation: 'Director',
      }),
      sessionCookie,
    );
    assert.equal(saved.status, 302);

    let removed = await postForm(
      router,
      action,
      invoicingFormFields({
        remove_logo: 'on',
        remove_signature_image: 'on',
        signatory_name: '',
        signatory_designation: '',
      }),
      sessionCookie,
    );
    assert.equal(removed.status, 302);

    let row = await findInvoicingProfile(organizationId);
    assert.ok(row);
    assert.equal(row.logo_data_url, null);
    assert.equal(row.signature_data_url, null);
    assert.equal(row.signatory_name, null);
    assert.equal(row.signatory_designation, null);

    let html = await getHtml(router, index, sessionCookie);
    assert.doesNotMatch(html, /alt="Organization logo"/);
    assert.doesNotMatch(html, /alt="Authorized signature"/);
  });

  it('rejects unsafe MIME types and malformed data URLs with 400s that preserve the draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-image-mime',
    );
    let badLogo = imageDataUrl('image/gif', Buffer.from('gif'));

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        logo: badLogo,
        signature_image: 'not a data url',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Logo must be a PNG, JPEG, or WebP image data URL\./);
    assert.match(html, /Signature must be a PNG, JPEG, or WebP image data URL\./);
    assert.ok(html.includes(`value="${badLogo}"`), 'the rejected logo data URL is preserved');
    assert.match(html, /name="signature_image"[^>]*value="not a data url"/);
    assert.match(html, /name="logo"[^>]*aria-invalid="true"/);
    assert.equal(await findInvoicingProfile(organizationId), null);
  });

  it('rejects logo and signature images above the byte limit', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-image-size',
    );
    let oversized = imageDataUrl('image/png', Buffer.alloc(128 * 1024 + 1, 1));

    let response = await postForm(
      router,
      action,
      invoicingFormFields({ logo: oversized, signature_image: oversized }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Logo image must be 128 KB or smaller\./);
    assert.match(html, /Signature image must be 128 KB or smaller\./);
    assert.equal(await findInvoicingProfile(organizationId), null);
  });

  it('rejects overlong signatory text without storing it', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'inv-image-signatory',
    );
    let longName = 'N'.repeat(121);
    let longDesignation = 'D'.repeat(101);

    let response = await postForm(
      router,
      action,
      invoicingFormFields({
        signatory_name: longName,
        signatory_designation: longDesignation,
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Signatory name must be 120 characters or fewer\./);
    assert.match(html, /Signatory designation must be 100 characters or fewer\./);
    assert.match(html, new RegExp(`name="signatory_name"[^>]*value="${longName}"`));
    assert.equal(await findInvoicingProfile(organizationId), null);
  });

  it('keeps image settings private and ignores a forged Organization id', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'inv-image-owner');
    let other = await createUserAndLoginWithOrganization(router, 'inv-image-other');

    let saved = await postForm(
      router,
      action,
      invoicingFormFields({ logo, signatory_name: 'Secret Signatory' }),
      owner.sessionCookie,
    );
    assert.equal(saved.status, 302);

    let otherPage = await getHtml(router, index, other.sessionCookie);
    assert.doesNotMatch(otherPage, /alt="Organization logo"/);
    assert.doesNotMatch(otherPage, /Secret Signatory/);

    let forged = await postForm(
      router,
      action,
      invoicingFormFields({
        organization_id: owner.organizationId,
        logo: newLogo,
        signatory_name: 'Forged Signatory',
      }),
      other.sessionCookie,
    );
    assert.equal(forged.status, 302);

    let ownerRow = await findInvoicingProfile(owner.organizationId);
    let otherRow = await findInvoicingProfile(other.organizationId);
    assert.ok(ownerRow);
    assert.ok(otherRow);
    assert.equal(ownerRow.logo_data_url, logo);
    assert.equal(ownerRow.signatory_name, 'Secret Signatory');
    assert.equal(otherRow.logo_data_url, newLogo);
    assert.equal(otherRow.signatory_name, 'Forged Signatory');
  });

  it('rejects image settings changes without a CSRF token', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'inv-image-csrf');
    let page = await getHtml(router, index, sessionCookie);
    assert.ok(page);

    let noCsrf = await router.fetch(new URL(action, 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(invoicingFormFields({ logo })).toString(),
    });
    assert.equal(noCsrf.status, 403);
  });
});
