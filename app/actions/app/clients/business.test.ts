import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { APP_NAME } from '../../../config.ts';
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

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function newClientFields(fields: Record<string, string>) {
  return {
    type: 'business',
    preferred_name: '',
    trading_name: '',
    industry: '',
    ...fields,
  };
}

async function createBusiness(sessionCookie: string, fields: Record<string, string>) {
  let response = await postForm(
    router,
    routes.app.clients.create.href(),
    newClientFields(fields),
    sessionCookie,
  );
  assert.equal(response.status, 302, 'a valid Business should be created');
  return response;
}

describe('business clients', () => {
  it('creates, views, and edits a Business profile with a trading name and industry', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Northwind Trading Private Limited');
    let tradingName = uniqueName('Northwind');
    let industry = uniqueName('Freight and logistics');

    let created = await createBusiness(sessionCookie, {
      legal_name: legalName,
      trading_name: tradingName,
      industry,
    });
    let location = created.headers.get('Location');
    assert.ok(location, 'create should redirect to the profile');

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row, 'the Business should be persisted');
    assert.equal(location, routes.app.clients.show.href({ clientId: row.id }));
    assert.equal(row.type, 'business');
    assert.equal(row.trading_name, tradingName);
    assert.equal(row.industry, industry);
    assert.equal(row.status, 'active');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, new RegExp(`<title>${tradingName} \\| ${APP_NAME}<\\/title>`));
    assert.match(profile, new RegExp(`<p role="status"[^>]*>Client created<\\/p>`));
    assert.match(profile, /Business client profile/);
    assert.match(profile, new RegExp(`>${tradingName}<`));
    assert.match(profile, new RegExp(`>${legalName}<`));
    assert.match(profile, /<dt[^>]*>Industry<\/dt>/);
    assert.match(profile, new RegExp(`>${industry}<`));
    assert.match(profile, /<meta name="robots" content="noindex"/);

    let directory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(tradingName));
    assert.match(directory, new RegExp(legalName));
    assert.match(directory, new RegExp(industry));

    let editPath = routes.app.clients.edit.href({ clientId: row.id });
    let editPage = await getHtml(router, editPath, sessionCookie);
    assert.match(editPage, new RegExp(`<title>Edit ${tradingName} \\| ${APP_NAME}<\\/title>`));
    assert.match(editPage, new RegExp(`name="legal_name"[^>]*value="${legalName}"`));
    assert.match(editPage, new RegExp(`name="trading_name"[^>]*value="${tradingName}"`));
    assert.match(editPage, new RegExp(`name="industry"[^>]*value="${industry}"`));

    let updatedLegalName = uniqueName('Northwind Global Private Limited');
    let updatedIndustry = uniqueName('International freight');
    let edited = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({
        _method: 'PUT',
        legal_name: updatedLegalName,
        trading_name: tradingName,
        industry: updatedIndustry,
      }),
      sessionCookie,
    );
    assert.equal(edited.status, 302);
    assert.equal(edited.headers.get('Location'), location);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.type, 'business');
    assert.equal(stored?.legal_name, updatedLegalName);
    assert.equal(stored?.trading_name, tradingName);
    assert.equal(stored?.industry, updatedIndustry);

    let updatedProfile = await getHtml(router, location, sessionCookie);
    assert.match(updatedProfile, new RegExp(`<p role="status"[^>]*>Client updated<\\/p>`));
    assert.match(updatedProfile, new RegExp(updatedIndustry));
    assert.match(updatedProfile, new RegExp(updatedLegalName));
  });

  it('requires a Business legal name and preserves submitted business values', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let tradingName = uniqueName('Nameless Trading');
    let industry = uniqueName('Hospitality');

    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      newClientFields({
        legal_name: '',
        trading_name: tradingName,
        industry,
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter the legal name\./);
    assert.match(html, /name="legal_name"[^>]*aria-invalid="true"/);
    assert.match(html, new RegExp(`name="trading_name"[^>]*value="${tradingName}"`));
    assert.match(html, new RegExp(`name="industry"[^>]*value="${industry}"`));
    assert.match(html, /<meta name="robots" content="noindex"/);

    let persisted = await db.findOne(clients, { where: { trading_name: tradingName } });
    assert.equal(persisted, null, 'invalid submissions should not create a client');
  });

  it('accepts a Business with only a legal name and falls back to it as the display label', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Sole Trader Proprietorship');

    let created = await createBusiness(sessionCookie, { legal_name: legalName });
    let location = created.headers.get('Location');
    assert.ok(location);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.trading_name, null);
    assert.equal(row.industry, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, new RegExp(`<title>${legalName} \\| ${APP_NAME}<\\/title>`));
    assert.doesNotMatch(profile, /<dt[^>]*>Industry<\/dt>/);

    let directory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(legalName));

    let editPage = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(editPage, /name="trading_name"[^>]*value=""/);
    assert.match(editPage, /name="industry"[^>]*value=""/);
  });

  it('uses the trading name as the display label when one is set', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Acme Manufacturing Limited');
    let tradingName = uniqueName('Acme Works');

    let created = await createBusiness(sessionCookie, {
      legal_name: legalName,
      trading_name: tradingName,
    });
    let location = created.headers.get('Location');
    assert.ok(location);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, new RegExp(`<title>${tradingName} \\| ${APP_NAME}<\\/title>`));
    assert.match(profile, new RegExp(`<h1[^>]*>${tradingName}<\\/h1>`));

    let directory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(directory, new RegExp(tradingName));
    assert.match(directory, new RegExp(legalName));
  });

  it('shows shared email and phone in the directory and industry only for Businesses', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let businessName = uniqueName('Directory Contact Business');
    let businessEmail = `directory-${crypto.randomUUID()}@example.com`;
    let businessPhone = '+44 20 7946 0958';
    let industry = uniqueName('Logistics');

    await createBusiness(sessionCookie, {
      legal_name: businessName,
      email: businessEmail,
      phone: businessPhone,
      industry,
    });

    let directory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.ok(directory.includes(businessEmail));
    assert.ok(directory.includes(businessPhone));
    assert.match(directory, new RegExp(industry));

    let individualName = uniqueName('Directory Contact Individual');
    let individualEmail = `directory-${crypto.randomUUID()}@example.com`;
    let individualPhone = '+61 2 9374 4000';
    let created = await postForm(
      router,
      routes.app.clients.create.href(),
      {
        type: 'individual',
        legal_name: individualName,
        email: individualEmail,
        phone: individualPhone,
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);

    let updatedDirectory = await getHtml(
      router,
      routes.app.clients.index.href(),
      sessionCookie,
    );
    assert.ok(updatedDirectory.includes(individualEmail));
    assert.ok(updatedDirectory.includes(individualPhone));
  });

  it('changes type in both directions and keeps hidden type-specific values', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Ada Lovelace');
    let preferredName = uniqueName('Ada');
    let tradingName = uniqueName('Analytical Engines');
    let industry = uniqueName('Computing');

    let created = await postForm(
      router,
      routes.app.clients.create.href(),
      {
        type: 'individual',
        legal_name: legalName,
        preferred_name: preferredName,
        trading_name: '',
        industry: '',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.type, 'individual');
    assert.equal(row.preferred_name, preferredName);

    let toBusiness = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({
        _method: 'PUT',
        legal_name: legalName,
        preferred_name: preferredName,
        trading_name: tradingName,
        industry,
      }),
      sessionCookie,
    );
    assert.equal(toBusiness.status, 302);

    let businessRow = await db.find(clients, row.id);
    assert.equal(businessRow?.type, 'business');
    assert.equal(businessRow?.preferred_name, preferredName, 'the hidden preferred name should persist');
    assert.equal(businessRow?.trading_name, tradingName);
    assert.equal(businessRow?.industry, industry);

    let businessProfile = await getHtml(router, location, sessionCookie);
    assert.match(businessProfile, new RegExp(`<title>${tradingName} \\| ${APP_NAME}<\\/title>`));
    assert.match(businessProfile, new RegExp(industry));
    assert.match(businessProfile, /<dt[^>]*>Trading name<\/dt>/);
    assert.doesNotMatch(businessProfile, /<dt[^>]*>Preferred name<\/dt>/);

    let businessDirectory = await getHtml(router, routes.app.clients.index.href(), sessionCookie);
    assert.match(businessDirectory, new RegExp(industry));

    // The hidden Individual group stays in the Business edit form, so its value survives.
    let businessEdit = await getHtml(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(businessEdit, new RegExp(`name="preferred_name"[^>]*value="${preferredName}"`));
    assert.match(businessEdit, new RegExp(`name="industry"[^>]*value="${industry}"`));

    let toIndividual = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      {
        _method: 'PUT',
        type: 'individual',
        legal_name: legalName,
        preferred_name: preferredName,
        trading_name: tradingName,
        industry,
      },
      sessionCookie,
    );
    assert.equal(toIndividual.status, 302);

    let individualRow = await db.find(clients, row.id);
    assert.equal(individualRow?.type, 'individual');
    assert.equal(individualRow?.preferred_name, preferredName);
    assert.equal(individualRow?.trading_name, tradingName, 'the hidden trading name should persist');
    assert.equal(individualRow?.industry, industry, 'the hidden industry should persist');

    let individualProfile = await getHtml(router, location, sessionCookie);
    assert.match(individualProfile, new RegExp(`<title>${preferredName} \\| ${APP_NAME}<\\/title>`));
    assert.match(individualProfile, /<dt[^>]*>Preferred name<\/dt>/);
    assert.doesNotMatch(individualProfile, new RegExp(industry));
    assert.doesNotMatch(individualProfile, new RegExp(tradingName));
    assert.doesNotMatch(individualProfile, /<dt[^>]*>Industry<\/dt>/);
    assert.doesNotMatch(individualProfile, /<dt[^>]*>Trading name<\/dt>/);

    let individualDirectory = await getHtml(
      router,
      routes.app.clients.index.href(),
      sessionCookie,
    );
    assert.doesNotMatch(individualDirectory, new RegExp(industry));

    // Switching back to Business restores the preserved values without re-entering them.
    let editPath = routes.app.clients.edit.href({ clientId: row.id });
    let individualEdit = await getHtml(router, editPath, sessionCookie);
    assert.match(individualEdit, new RegExp(`name="trading_name"[^>]*value="${tradingName}"`));
    assert.match(individualEdit, new RegExp(`name="industry"[^>]*value="${industry}"`));

    let backToBusiness = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({
        _method: 'PUT',
        legal_name: legalName,
        preferred_name: preferredName,
        trading_name: tradingName,
        industry,
      }),
      sessionCookie,
    );
    assert.equal(backToBusiness.status, 302);

    let restored = await db.find(clients, row.id);
    assert.equal(restored?.type, 'business');
    assert.equal(restored?.trading_name, tradingName);
    assert.equal(restored?.industry, industry);

    let restoredProfile = await getHtml(router, location, sessionCookie);
    assert.match(restoredProfile, new RegExp(`<title>${tradingName} \\| ${APP_NAME}<\\/title>`));
    assert.match(restoredProfile, new RegExp(industry));
  });

  it('keeps Business profiles unavailable to a different Organization', async () => {
    let firstCookie = await createUserAndLogin(router, db, 'business');
    let secondCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Shared Business Legal');
    let tradingName = uniqueName('Shared Business Trading');
    let industry = uniqueName('Consulting');

    let created = await createBusiness(firstCookie, {
      legal_name: legalName,
      trading_name: tradingName,
      industry,
    });
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let secondProfile = await router.fetch(new URL(location, origin), {
      headers: { Cookie: secondCookie },
    });
    assert.equal(secondProfile.status, 404);
    let secondBody = await secondProfile.text();
    assert.doesNotMatch(secondBody, new RegExp(tradingName));
    assert.doesNotMatch(secondBody, new RegExp(industry));

    let updatedIndustry = uniqueName('Management consulting');
    let edited = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({
        _method: 'PUT',
        legal_name: legalName,
        trading_name: tradingName,
        industry: updatedIndustry,
      }),
      secondCookie,
    );
    assert.equal(edited.status, 404);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.industry, industry);

    let anonymous = await router.fetch(new URL(location, origin));
    assert.equal(anonymous.status, 302);
    let loginLocation = new URL(anonymous.headers.get('Location') ?? '', origin);
    assert.equal(loginLocation.pathname, routes.auth.login.index.href());
    assert.equal(loginLocation.searchParams.get('returnTo'), location);
  });

  it('rejects Business mutations without a CSRF token', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('No Token Business');

    let response = await router.fetch(new URL(routes.app.clients.create.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams(
        newClientFields({ legal_name: legalName }),
      ).toString(),
    });

    assert.equal(response.status, 403);
    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('trims Industry and stores a blank Industry as not recorded', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Trimmed Industry Limited');

    let created = await createBusiness(sessionCookie, {
      legal_name: legalName,
      industry: '   Professional services   ',
    });
    assert.equal(created.status, 302);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.industry, 'Professional services');

    let cleared = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({ _method: 'PUT',   legal_name: legalName, industry: '   ' }),
      sessionCookie,
    );
    assert.equal(cleared.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.industry, null);
  });

  it('keeps the stored Business profile when an edit fails validation', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'business');
    let legalName = uniqueName('Stable Business');
    let tradingName = uniqueName('Stable Trading');

    let created = await createBusiness(sessionCookie, {
      legal_name: legalName,
      trading_name: tradingName,
      industry: 'Retail',
    });
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let response = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: row.id }),
      routes.app.clients.update.href({ clientId: row.id }),
      newClientFields({
        _method: 'PUT',
        legal_name: '',
        trading_name: tradingName,
        industry: 'Wholesale',
      }),
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter the legal name\./);
    assert.match(html, new RegExp(`name="trading_name"[^>]*value="${tradingName}"`));
    assert.match(html, /name="industry"[^>]*value="Wholesale"/);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.legal_name, legalName);
    assert.equal(stored?.trading_name, tradingName);
    assert.equal(stored?.industry, 'Retail');

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, new RegExp(`<title>${tradingName} \\| ${APP_NAME}<\\/title>`));
  });
});
