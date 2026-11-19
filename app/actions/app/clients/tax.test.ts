import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients, db } from '../../../data/db.ts';
import '../../../../test/db-setup.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLogin,
  getHtml,
  origin,
  postForm,
  submitForm,
} from '../../../../test/http.ts';

/** A structurally valid 15-character GSTIN (format only; nothing is verified). */
const VALID_GSTIN = '27AAPCS2319F1Z5';
/** A structurally valid 15-character alphanumeric UIN. */
const VALID_UIN = 'AA1234567890123';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function clientFields(overrides: Record<string, string> = {}) {
  return {
    type: 'business',
    preferred_name: '',
    trading_name: '',
    industry: '',
    tax_country: '',
    tax_type: '',
    tax_value: '',
    tax_state_code: '',
    ...overrides,
  };
}

async function createProfile(
  sessionCookie: string,
  fields: Record<string, string>,
) {
  let response = await postForm(
    router,
    routes.app.clients.new.action.href(),
    clientFields(fields),
    sessionCookie,
  );
  assert.equal(response.status, 302, 'a valid client should be created');
  let location = response.headers.get('Location');
  assert.ok(location, 'create should redirect to the profile');
  return { response, location };
}

describe('client tax identifiers', () => {
  it('records a generic tax identifier with its country, type, and value', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Generic Tax Client');

    let { location } = await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'GB',
      tax_type: 'VAT',
      tax_value: ' gb123456789 ',
    });

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row, 'the client should be persisted');
    assert.equal(row.tax_country, 'GB');
    assert.equal(row.tax_type, 'VAT');
    assert.equal(row.tax_value, 'GB123456789', 'the value should be trimmed and uppercased');
    assert.equal(row.tax_state_name, null);
    assert.equal(row.tax_state_code, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /<p role="status"[^>]*>Client created<\/p>/);
    assert.match(profile, /<h2[^>]*>Tax identifier<\/h2>/);
    assert.match(profile, /GB123456789/);
    assert.match(profile, />VAT</);
    assert.match(profile, />GB</);
  });

  it('records an India GSTIN with its State or UT name and code', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('GSTIN Client');

    let { location } = await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'in',
      tax_type: 'gstin',
      tax_value: ' 27aapcs2319f1z5 ',
      tax_state_code: '27',
    });

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.tax_country, 'IN');
    assert.equal(row.tax_type, 'gstin');
    assert.equal(row.tax_value, VALID_GSTIN);
    assert.equal(row.tax_state_name, 'Maharashtra');
    assert.equal(row.tax_state_code, '27');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, new RegExp(VALID_GSTIN));
    assert.match(profile, />GSTIN</);
    assert.match(profile, />India</);
    assert.match(profile, /Maharashtra/);
    assert.match(profile, /\(27\)/);

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.index.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, new RegExp(`name="tax_value"[^>]*value="${VALID_GSTIN}"`));
    assert.match(editPage, /<option[^>]*value="27"[^>]*selected/);
  });

  it('rejects a GSTIN whose State code differs from the selected State/UT', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Mismatched GSTIN Client');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: VALID_GSTIN,
        tax_state_code: '29',
      }),
      sessionCookie,
    );

    assert.equal(created.status, 400);
    let createHtml = await created.text();
    assert.match(createHtml, /State or UT code must match the first two digits of the GSTIN/);
    assert.match(createHtml, /name="tax_value"[^>]*value="27AAPCS2319F1Z5"/);
    assert.match(createHtml, /name="tax_state_code"[^>]*aria-invalid="true"/);
    assert.match(createHtml, /<option[^>]*value="29"[^>]*selected/);
    assert.equal(await db.findOne(clients, { where: { legal_name: legalName } }), null);

    let existingName = uniqueName('Matching GSTIN Client');
    await createProfile(sessionCookie, {
      legal_name: existingName,
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: VALID_GSTIN,
      tax_state_code: '27',
    });
    let client = await db.findOne(clients, { where: { legal_name: existingName } });
    assert.ok(client);

    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: client.id }),
      clientFields({
        legal_name: existingName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: VALID_GSTIN,
        tax_state_code: '29',
      }),
      sessionCookie,
    );
    assert.equal(edited.status, 400);
    assert.match(await edited.text(), /State or UT code must match the first two digits of the GSTIN/);

    let stored = await db.find(clients, client.id);
    assert.equal(stored?.tax_state_code, '27');
    assert.equal(stored?.tax_value, VALID_GSTIN);
  });

  it('records an India UIN with its State or UT name and code', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('UIN Client');

    await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'India',
      tax_type: 'uin',
      tax_value: 'aa1234567890123',
      tax_state_code: '07',
    });

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.tax_country, 'IN');
    assert.equal(row.tax_type, 'uin');
    assert.equal(row.tax_value, VALID_UIN);
    assert.equal(row.tax_state_name, 'Delhi');
    assert.equal(row.tax_state_code, '07');
  });

  it('treats blank tax fields as not recorded and never claims unregistered status', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('No Tax Client');

    let { location } = await createProfile(sessionCookie, { legal_name: legalName });

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.tax_country, null);
    assert.equal(row.tax_type, null);
    assert.equal(row.tax_value, null);
    assert.equal(row.tax_state_name, null);
    assert.equal(row.tax_state_code, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.doesNotMatch(profile, /<h2[^>]*>Tax identifier<\/h2>/);
    assert.doesNotMatch(profile, /unregistered/i);

    let newPage = await getHtml(router, routes.app.clients.new.index.href(), sessionCookie);
    assert.doesNotMatch(newPage, /unregistered/i);

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.index.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.doesNotMatch(editPage, /unregistered/i);
    assert.match(editPage, /name="tax_value"[^>]*value=""/);
  });

  it('clears the identifier when every tax field is blank on edit', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Cleared Tax Client');
    let { location } = await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'GB',
      tax_type: 'VAT',
      tax_value: 'GB999999999',
    });
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let cleared = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      clientFields({ legal_name: legalName }),
      sessionCookie,
    );
    assert.equal(cleared.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.tax_country, null);
    assert.equal(stored?.tax_type, null);
    assert.equal(stored?.tax_value, null);
    assert.equal(stored?.tax_state_name, null);
    assert.equal(stored?.tax_state_code, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.doesNotMatch(profile, /<h2[^>]*>Tax identifier<\/h2>/);
  });

  it('rejects an invalid India GSTIN and preserves the submitted tax values', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Invalid GSTIN Client');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: '12345',
        tax_state_code: '27',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /15-character GSTIN/);
    assert.match(html, /name="tax_value"[^>]*value="12345"/);
    assert.match(html, /name="tax_country"[^>]*value="IN"/);
    assert.match(html, /name="tax_type"[^>]*value="gstin"/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null, 'invalid submissions should not create a client');
  });

  it('rejects an invalid India UIN', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Invalid UIN Client');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'uin',
        tax_value: 'SHORT12',
        tax_state_code: '07',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    assert.match(await response.text(), /15-character alphanumeric UIN/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('requires a State or UT for an India tax identifier', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Stateless GSTIN Client');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: VALID_GSTIN,
        tax_state_code: '',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Choose the State or UT/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('only accepts GSTIN or UIN for an India tax identifier', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('India VAT Client');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'VAT',
        tax_value: VALID_GSTIN,
        tax_state_code: '27',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    assert.match(await response.text(), /use GSTIN or UIN/);
  });

  it('keeps at most one tax identifier per client', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Single Tax Client');
    await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'GB',
      tax_type: 'VAT',
      tax_value: 'GB111111111',
    });
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: VALID_GSTIN,
        tax_state_code: '27',
      }),
      sessionCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.tax_country, 'IN');
    assert.equal(stored?.tax_type, 'gstin');
    assert.equal(stored?.tax_value, VALID_GSTIN);
    assert.equal(stored?.tax_state_name, 'Maharashtra');

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.index.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.equal(
      (editPage.match(/name="tax_value"/g) ?? []).length,
      1,
      'the form should offer exactly one tax identifier value',
    );
    assert.equal((editPage.match(/name="tax_country"/g) ?? []).length, 1);

    let profile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(profile, new RegExp(VALID_GSTIN));
    assert.doesNotMatch(profile, /GB111111111/);
  });

  it('warns about a duplicate tax identifier but still saves the client', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let firstLegalName = uniqueName('First GSTIN Client');
    await createProfile(sessionCookie, {
      legal_name: firstLegalName,
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: VALID_GSTIN,
      tax_state_code: '27',
    });

    let secondLegalName = uniqueName('Duplicate GSTIN Client');
    let created = await createProfile(sessionCookie, {
      legal_name: secondLegalName,
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: VALID_GSTIN.toLowerCase(),
      tax_state_code: '27',
    });

    let row = await db.findOne(clients, { where: { legal_name: secondLegalName } });
    assert.ok(row, 'the duplicate identifier must still be saved');
    assert.equal(row.tax_value, VALID_GSTIN);

    let profile = await getHtml(router, created.location, sessionCookie);
    assert.match(profile, /<p role="status"[^>]*>Client created\./);
    assert.match(profile, /already recorded on another client/);
    assert.match(profile, /saved anyway/);
  });

  it('does not warn when a client keeps its own tax identifier', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Own GSTIN Client');
    let ownGstin = '27AAPCS2319F2Z7';
    let { location } = await createProfile(sessionCookie, {
      legal_name: legalName,
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: ownGstin,
      tax_state_code: '27',
    });
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      clientFields({
        legal_name: legalName,
        tax_country: 'IN',
        tax_type: 'gstin',
        tax_value: ownGstin,
        tax_state_code: '27',
      }),
      sessionCookie,
    );
    assert.equal(edited.status, 302);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /<p role="status"[^>]*>Client updated<\/p>/);
    assert.doesNotMatch(profile, /already recorded/);
  });

  it('does not disclose or edit another Organization’s tax identifier', async () => {
    let firstCookie = await createUserAndLogin(router, 'tax');
    let secondCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('Shared Tax Client');

    let { location } = await createProfile(firstCookie, {
      legal_name: legalName,
      tax_country: 'GB',
      tax_type: 'VAT',
      tax_value: 'GB222222222',
    });
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let secondProfile = await router.fetch(new URL(location, origin), {
      headers: { Cookie: secondCookie },
    });
    assert.equal(secondProfile.status, 404);
    assert.doesNotMatch(await secondProfile.text(), /GB222222222/);

    let edited = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.edit.action.href({ clientId: row.id }),
      clientFields({
        legal_name: legalName,
        tax_country: 'US',
        tax_type: 'EIN',
        tax_value: '12-3456789',
      }),
      secondCookie,
    );
    assert.equal(edited.status, 404);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.tax_country, 'GB');
    assert.equal(stored?.tax_type, 'VAT');
    assert.equal(stored?.tax_value, 'GB222222222');
  });

  it('rejects tax identifier mutations without a CSRF token', async () => {
    let sessionCookie = await createUserAndLogin(router, 'tax');
    let legalName = uniqueName('No CSRF Tax Client');

    let response = await router.fetch(new URL(routes.app.clients.new.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(
        clientFields({
          legal_name: legalName,
          tax_country: 'IN',
          tax_type: 'gstin',
          tax_value: VALID_GSTIN,
          tax_state_code: '27',
        }),
      ).toString(),
    });

    assert.equal(response.status, 403);
    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });
});
