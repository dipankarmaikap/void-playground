import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients } from '../../../data/db.ts';
import { createTestRouter } from '../../../../test/router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLogin,
  getHtml,
  origin,
  postForm,
  submitForm,
} from '../../../../test/http.ts';

const { router, db } = await createTestRouter();

const blankBilling = {
  billing_line1: '',
  billing_locality: '',
  billing_region: '',
  billing_postal_code: '',
  billing_country: '',
  billing_currency: '',
};

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function clientFields(overrides: Record<string, string>) {
  return {
    type: 'individual',
    legal_name: uniqueName('Billing Client'),
    ...blankBilling,
    ...overrides,
  };
}

async function createClient(sessionCookie: string, fields: Record<string, string>) {
  let response = await postForm(
    router,
    routes.app.clients.create.href(),
    clientFields(fields),
    sessionCookie,
  );
  assert.equal(response.status, 302, 'a valid Client should be created');
  return response;
}

function locationOf(response: Response) {
  let location = response.headers.get('Location');
  assert.ok(location, 'create should redirect to the profile');
  return location;
}

describe('client billing details', () => {
  it('creates a client with no billing address or currency', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('No Billing Client');

    let created = await createClient(sessionCookie, { legal_name: legalName });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row, 'the Client should be persisted');
    assert.equal(row.billing_line1, null);
    assert.equal(row.billing_locality, null);
    assert.equal(row.billing_region, null);
    assert.equal(row.billing_postal_code, null);
    assert.equal(row.billing_country, null);
    assert.equal(row.billing_currency, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /No billing details recorded\./);
    assert.doesNotMatch(profile, /Billing address/);
    assert.doesNotMatch(profile, /Default currency/);
  });

  it('requires address line 1 and country when any address field is entered', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Partial Address');

    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      clientFields({
        legal_name: legalName,
        billing_locality: 'Bengaluru',
        billing_postal_code: '560001',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter billing address line 1\./);
    assert.match(html, /Enter a billing country\./);
    assert.match(html, /name="billing_line1"[^>]*aria-invalid="true"/);
    assert.match(html, /name="billing_country"[^>]*aria-invalid="true"/);
    assert.match(html, /name="billing_locality"[^>]*value="Bengaluru"/);
    assert.match(html, /name="billing_postal_code"[^>]*value="560001"/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null, 'an incomplete address should not create a Client');

    let missingCountryName = uniqueName('Address Without Country');
    let missingCountry = await postForm(
      router,
      routes.app.clients.create.href(),
      clientFields({ legal_name: missingCountryName, billing_line1: '1 Main Street' }),
      sessionCookie,
    );
    assert.equal(missingCountry.status, 400);
    let missingCountryHtml = await missingCountry.text();
    assert.match(missingCountryHtml, /Enter a billing country\./);
    assert.doesNotMatch(missingCountryHtml, /Enter billing address line 1\./);
  });

  it('accepts an address without locality, region, or postal code', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Minimal Address');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '  12 Residency Road  ',
      billing_country: 'IN',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_line1, '12 Residency Road');
    assert.equal(row.billing_locality, null);
    assert.equal(row.billing_region, null);
    assert.equal(row.billing_postal_code, null);
    assert.equal(row.billing_country, 'IN');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /Billing address/);
    assert.match(profile, /12 Residency Road/);
    assert.match(profile, />India</);
  });

  it('stores and edits the full billing address on an Individual profile', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Individual Billing');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '500 Congress Avenue',
      billing_locality: 'Austin',
      billing_region: 'Texas',
      billing_postal_code: '78701',
      billing_country: 'US',
      billing_currency: 'USD',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_line1, '500 Congress Avenue');
    assert.equal(row.billing_locality, 'Austin');
    assert.equal(row.billing_region, 'Texas');
    assert.equal(row.billing_postal_code, '78701');
    assert.equal(row.billing_country, 'US');
    assert.equal(row.billing_currency, 'USD');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /500 Congress Avenue/);
    assert.match(profile, /Austin/);
    assert.match(profile, /Texas/);
    assert.match(profile, /78701/);
    assert.match(profile, />United States</);
    assert.match(profile, /USD/);

    let editPath = routes.app.clients.edit.href({ clientId: row.id });
    let editPage = await getHtml(router, editPath, sessionCookie);
    assert.match(editPage, /name="billing_line1"[^>]*value="500 Congress Avenue"/);
    assert.match(editPage, /name="billing_locality"[^>]*value="Austin"/);
    assert.match(editPage, /name="billing_region"[^>]*value="Texas"/);
    assert.match(editPage, /name="billing_postal_code"[^>]*value="78701"/);
    assert.match(editPage, /name="billing_country"[^>]*value="United States"/);
    assert.match(editPage, /name="billing_currency"[^>]*value="USD"/);
    assert.match(editPage, /<datalist id="billing-countries"/);

    let edited = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      clientFields({
        _method: 'PUT',
        legal_name: legalName,
        billing_line1: '600 Congress Avenue',
        billing_locality: 'Austin',
        billing_region: 'Texas',
        billing_postal_code: '78701',
        billing_country: 'US',
        billing_currency: 'USD',
      }),
      sessionCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.billing_line1, '600 Congress Avenue');

    let updatedProfile = await getHtml(router, location, sessionCookie);
    assert.match(updatedProfile, /600 Congress Avenue/);
    assert.match(updatedProfile, /<p role="status"[^>]*>Client updated<\/p>/);
  });

  it('stores billing details on a Business profile', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Business Billing Legal');
    let tradingName = uniqueName('Business Billing Trading');

    let created = await createClient(sessionCookie, {
      type: 'business',
      legal_name: legalName,
      trading_name: tradingName,
      billing_line1: 'Sheikh Zayed Road 1',
      billing_locality: 'Dubai',
      billing_country: 'AE',
      billing_currency: 'AED',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.type, 'business');
    assert.equal(row.billing_line1, 'Sheikh Zayed Road 1');
    assert.equal(row.billing_country, 'AE');
    assert.equal(row.billing_currency, 'AED');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /Business client profile/);
    assert.match(profile, /Sheikh Zayed Road 1/);
    assert.match(profile, /Dubai/);
    assert.match(profile, />United Arab Emirates</);
    assert.match(profile, /AED/);

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, /name="billing_country"[^>]*value="United Arab Emirates"/);
    assert.match(editPage, /name="billing_currency"[^>]*value="AED"/);
  });

  it('stores a blank currency as null while keeping the address and shows the suggestion before save', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Blank Currency');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '14 MG Road',
      billing_country: 'IN',
      billing_currency: '',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_line1, '14 MG Road');
    assert.equal(row.billing_country, 'IN');
    assert.equal(row.billing_currency, null, 'a blank currency should stay unrecorded');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /Billing address/);
    assert.match(profile, />India</);
    assert.doesNotMatch(profile, /Default currency/);
    assert.doesNotMatch(profile, /Indian Rupee/);

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, /Suggested for India: INR — Indian Rupee/);
    assert.match(editPage, /Leave blank to record no currency/);
    assert.match(editPage, /name="billing_country"[^>]*value="India"/);
    assert.match(editPage, /name="billing_currency"[^>]*value=""/);
  });

  it('accepts an unlisted country as entered and canonicalizes known country names', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Unlisted Country');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '1 Coast Road',
      billing_locality: 'Willemstad',
      billing_country: '  Curaçao  ',
      billing_currency: '',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_country, 'Curaçao', 'an unlisted country should be kept as entered');
    assert.equal(row.billing_currency, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /Curaçao/);
    assert.doesNotMatch(profile, /Default currency/);

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, /name="billing_country"[^>]*value="Curaçao"/);

    let namedCountry = uniqueName('Named Country');
    await createClient(sessionCookie, {
      legal_name: namedCountry,
      billing_line1: '2 Marine Drive',
      billing_country: ' india ',
    });
    let namedRow = await db.findOne(clients, { where: { legal_name: namedCountry } });
    assert.equal(namedRow?.billing_country, 'IN', 'a known country name should canonicalize');
  });

  it('accepts an unlisted 3-letter currency code', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Unlisted Currency');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '10 Market Street',
      billing_country: 'CM',
      billing_currency: 'xaf',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_currency, 'XAF', 'an unlisted 3-letter code should be accepted');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /Default currency/);
    assert.match(profile, /XAF/);
  });

  it('keeps an explicit currency instead of the country suggestion', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Explicit Currency');

    await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '22 Brigade Road',
      billing_country: 'IN',
      billing_currency: 'usd',
    });

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_country, 'IN');
    assert.equal(row.billing_currency, 'USD', 'the explicit currency should win and normalize');
  });

  it('accepts a manual currency with no billing address', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Manual Currency');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_currency: 'EUR',
    });
    let location = locationOf(created);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.billing_line1, null);
    assert.equal(row.billing_country, null);
    assert.equal(row.billing_currency, 'EUR');

    let profile = await getHtml(router, location, sessionCookie);
    assert.doesNotMatch(profile, /Billing address/);
    assert.match(profile, /Default currency/);
    assert.match(profile, /EUR/);
    assert.match(profile, /Euro/);
  });

  it('rejects an invalid currency and preserves the submitted values', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Invalid Currency');

    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      clientFields({
        legal_name: legalName,
        billing_line1: '7 Church Street',
        billing_country: 'IN',
        billing_currency: 'EURO',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /3-letter currency code/i);
    assert.match(html, /name="billing_currency"[^>]*value="EURO"/);
    assert.match(html, /name="billing_currency"[^>]*aria-invalid="true"/);
    assert.match(html, /name="billing_line1"[^>]*value="7 Church Street"/);
    assert.match(html, /name="billing_country"[^>]*value="India"/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('keeps the stored billing details when an edit fails validation', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Stable Billing');

    let created = await createClient(sessionCookie, {
      legal_name: legalName,
      billing_line1: '1 Original Street',
      billing_country: 'IN',
      billing_currency: 'INR',
    });
    let location = locationOf(created);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let response = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      clientFields({
        _method: 'PUT',
        legal_name: legalName,
        billing_line1: '2 Invalid Street',
        billing_country: 'IN',
        billing_currency: 'EURO',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /3-letter currency code/i);
    assert.match(html, /name="billing_line1"[^>]*value="2 Invalid Street"/);
    assert.match(html, /name="billing_currency"[^>]*value="EURO"/);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.billing_line1, '1 Original Street');
    assert.equal(stored?.billing_currency, 'INR');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /1 Original Street/);
    assert.doesNotMatch(profile, /2 Invalid Street/);
  });

  it('does not disclose or edit another Organization’s billing details', async () => {
    let firstCookie = await createUserAndLogin(router, db, 'billing');
    let secondCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('Shared Billing');

    let created = await createClient(firstCookie, {
      legal_name: legalName,
      billing_line1: '8 Shared Lane',
      billing_locality: 'Pune',
      billing_country: 'IN',
      billing_currency: 'INR',
    });
    let location = locationOf(created);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let secondProfile = await router.fetch(new URL(location, origin), {
      headers: { Cookie: secondCookie },
    });
    assert.equal(secondProfile.status, 404);
    let secondBody = await secondProfile.text();
    assert.doesNotMatch(secondBody, /8 Shared Lane/);
    assert.doesNotMatch(secondBody, /Pune/);

    let edited = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.update.href({ clientId: row.id }),
      clientFields({
        _method: 'PUT',
        legal_name: legalName,
        billing_line1: '9 Shared Lane',
        billing_locality: 'Pune',
        billing_country: 'IN',
        billing_currency: 'INR',
      }),
      secondCookie,
    );
    assert.equal(edited.status, 404);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.billing_line1, '8 Shared Lane');
  });

  it('rejects billing mutations without a CSRF token', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'billing');
    let legalName = uniqueName('No Token Billing');

    let response = await router.fetch(new URL(routes.app.clients.create.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(
        clientFields({
          legal_name: legalName,
          billing_line1: '3 No Token Road',
          billing_country: 'IN',
        }),
      ).toString(),
    });

    assert.equal(response.status, 403);
    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });
});
