import * as assert from 'remix/assert';
import { beforeEach, describe, it } from 'remix/test';

import { clients, db } from '../../../data/db.ts';
import type { Client } from '../../../data/db.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { createUserAndLogin, getHtml, origin, postForm } from '../../../../test/http.ts';

type ClientFixture = Partial<Client> & Pick<Client, 'type' | 'legal_name'>;

function indexHref(params: Record<string, string> = {}) {
  return Object.keys(params).length === 0
    ? routes.app.clients.index.href()
    : routes.app.clients.index.href({}, { searchParams: params });
}

async function createClient(fixture: ClientFixture): Promise<Client> {
  let now = Date.now();
  return db.create(
    clients,
    {
      id: crypto.randomUUID(),
      status: 'active',
      archived_at: null,
      created_at: now,
      updated_at: now,
      ...fixture,
    },
    { returnRow: true },
  );
}

function unique(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function includes(html: string, value: string) {
  assert.ok(html.includes(value), `expected the page to include ${value}`);
}

beforeEach(async () => {
  await db.exec('DELETE FROM clients');
});

describe('client directory search and filters', () => {
  it('searches individual legal and preferred names and business legal and trading names', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let legalToken = crypto.randomUUID();
    let preferredToken = crypto.randomUUID();
    let tradingToken = crypto.randomUUID();

    let individual = await createClient({
      type: 'individual',
      legal_name: `Legal ${legalToken}`,
      preferred_name: `Preferred ${preferredToken}`,
    });
    let business = await createClient({
      type: 'business',
      legal_name: `Legal ${crypto.randomUUID()}`,
      trading_name: `Trading ${tradingToken}`,
    });

    for (let token of [legalToken, preferredToken]) {
      let html = await getHtml(router, indexHref({ q: token }), sessionCookie);
      includes(html, individual.legal_name);
      assert.ok(
        !html.includes(business.legal_name),
        'an unrelated Client should not match a name search',
      );
    }

    let tradingHtml = await getHtml(router, indexHref({ q: tradingToken }), sessionCookie);
    includes(tradingHtml, business.legal_name);
    assert.ok(
      !tradingHtml.includes(individual.legal_name),
      'a trading-name search should not return the unrelated Individual',
    );
  });

  it('searches Client email and phone plus primary-contact email and phone', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let email = `client-${crypto.randomUUID()}@example.com`;
    let phone = `+1 555 ${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    let contactEmail = `contact-${crypto.randomUUID()}@example.com`;
    let contactPhone = `+44 20 ${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

    let individual = await createClient({
      type: 'individual',
      legal_name: unique('Contact Individual'),
      email,
      phone,
    });
    let business = await createClient({
      type: 'business',
      legal_name: unique('Contact Business'),
      contact_name: 'Primary Contact',
      contact_email: contactEmail,
      contact_phone: contactPhone,
    });

    for (let [term, expected, unexpected] of [
      [email, individual, business],
      [phone, individual, business],
      [contactEmail, business, individual],
      [contactPhone, business, individual],
    ] as const) {
      let html = await getHtml(router, indexHref({ q: term }), sessionCookie);
      includes(html, expected.legal_name);
      assert.ok(!html.includes(unexpected.legal_name), `${term} should only match its Client`);
    }
  });

  it('matches search terms case-insensitively', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let token = `CaseMixed${crypto.randomUUID().replaceAll('-', '')}`;
    let client = await createClient({
      type: 'individual',
      legal_name: `Mixed ${token}`,
    });

    let html = await getHtml(router, indexHref({ q: token.toUpperCase() }), sessionCookie);
    includes(html, client.legal_name);
  });

  it('filters by Individual and Business type', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let token = crypto.randomUUID();
    let individual = await createClient({
      type: 'individual',
      legal_name: `Type Individual ${token}`,
    });
    let business = await createClient({
      type: 'business',
      legal_name: `Type Business ${token}`,
    });

    let individuals = await getHtml(router, indexHref({ type: 'individual' }), sessionCookie);
    includes(individuals, individual.legal_name);
    assert.ok(!individuals.includes(business.legal_name));

    let businesses = await getHtml(router, indexHref({ type: 'business' }), sessionCookie);
    includes(businesses, business.legal_name);
    assert.ok(!businesses.includes(individual.legal_name));

    let all = await getHtml(router, indexHref({ type: 'all' }), sessionCookie);
    includes(all, individual.legal_name);
    includes(all, business.legal_name);
  });

  it('filters by Active and Archived status and keeps archived results searchable', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let token = crypto.randomUUID();
    let active = await createClient({
      type: 'individual',
      legal_name: `Status Active ${token}`,
    });
    let archived = await createClient({
      type: 'business',
      legal_name: `Status Archived ${token}`,
      status: 'archived',
      archived_at: Date.now(),
    });

    let activeView = await getHtml(router, indexHref(), sessionCookie);
    includes(activeView, active.legal_name);
    assert.ok(!activeView.includes(archived.legal_name));

    let archivedView = await getHtml(router, indexHref({ status: 'archived' }), sessionCookie);
    includes(archivedView, archived.legal_name);
    assert.ok(!archivedView.includes(active.legal_name));

    let explicitActive = await getHtml(router, indexHref({ status: 'active' }), sessionCookie);
    includes(explicitActive, active.legal_name);
    assert.ok(!explicitActive.includes(archived.legal_name));

    let archivedSearch = await getHtml(
      router,
      indexHref({ q: token, status: 'archived' }),
      sessionCookie,
    );
    includes(archivedSearch, archived.legal_name);
    assert.ok(!archivedSearch.includes(active.legal_name));
  });

  it('combines search, type, and status filters', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let token = crypto.randomUUID();
    let fixtures = [
      await createClient({ type: 'individual', legal_name: `Combo Individual Active ${token}` }),
      await createClient({ type: 'business', legal_name: `Combo Business Active ${token}` }),
      await createClient({
        type: 'individual',
        legal_name: `Combo Individual Archived ${token}`,
        status: 'archived',
        archived_at: Date.now(),
      }),
      await createClient({
        type: 'business',
        legal_name: `Combo Business Archived ${token}`,
        status: 'archived',
        archived_at: Date.now(),
      }),
    ];

    let html = await getHtml(
      router,
      indexHref({ q: token, type: 'business', status: 'archived' }),
      sessionCookie,
    );
    includes(html, fixtures[3].legal_name);
    for (let other of fixtures.slice(0, 3)) {
      assert.ok(!html.includes(other.legal_name), 'only the fully matching Client should render');
    }

    let activeBusiness = await getHtml(
      router,
      indexHref({ q: token, type: 'business', status: 'active' }),
      sessionCookie,
    );
    includes(activeBusiness, fixtures[1].legal_name);
    assert.ok(!activeBusiness.includes(fixtures[3].legal_name));
  });

  it('never searches tax identifiers, industry, or billing details', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let taxToken = `TAXVALUE${crypto.randomUUID().replaceAll('-', '')}`;
    let stateCodeToken = `STATECODE${crypto.randomUUID().replaceAll('-', '')}`;
    let industryToken = `Industry${crypto.randomUUID().replaceAll('-', '')}`;
    let addressToken = `Address${crypto.randomUUID().replaceAll('-', '')}`;
    let postalToken = `POSTAL${crypto.randomUUID().replaceAll('-', '')}`;

    let client = await createClient({
      type: 'business',
      legal_name: unique('Unsearchable Details'),
      tax_country: 'IN',
      tax_type: 'gstin',
      tax_value: taxToken,
      tax_state_name: 'Karnataka',
      tax_state_code: stateCodeToken,
      industry: industryToken,
      billing_line1: addressToken,
      billing_postal_code: postalToken,
      billing_country: 'IN',
    });

    for (let term of [taxToken, stateCodeToken, industryToken, addressToken, postalToken]) {
      let html = await getHtml(router, indexHref({ q: term }), sessionCookie);
      assert.match(html, /No clients match your search and filters\./);
      assert.ok(!html.includes(client.legal_name), `${term} should not match a Client`);
    }
  });

  it('searches the shared book for a second authenticated User', async () => {
    let firstCookie = await createUserAndLogin(router, 'search');
    let secondCookie = await createUserAndLogin(router, 'search');
    let legalName = unique('Shared Searchable');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName },
      firstCookie,
    );
    assert.equal(created.status, 302);

    let html = await getHtml(router, indexHref({ q: legalName }), secondCookie);
    includes(html, legalName);
  });

  it('distinguishes an empty Client book from an empty search result', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');

    let activeDirectory = await getHtml(router, indexHref(), sessionCookie);
    assert.match(activeDirectory, /No active clients yet\./);

    let archivedDirectory = await getHtml(router, indexHref({ status: 'archived' }), sessionCookie);
    assert.match(archivedDirectory, /No archived clients\./);

    await createClient({ type: 'individual', legal_name: unique('Present Client') });

    let missingToken = `missing-${crypto.randomUUID()}`;
    let noResults = await getHtml(router, indexHref({ q: missingToken }), sessionCookie);
    assert.match(noResults, /No clients match your search and filters\./);
    assert.doesNotMatch(noResults, /No active clients yet\./);

    let typeFiltered = await getHtml(router, indexHref({ type: 'business' }), sessionCookie);
    assert.match(typeFiltered, /No clients match your search and filters\./);
  });

  it('renders an accessible GET search/filter form and preserves submitted values', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');

    let html = await getHtml(
      router,
      indexHref({ q: 'Needle', type: 'business', status: 'archived' }),
      sessionCookie,
    );

    assert.match(html, /<form[^>]*method="get"/);
    assert.match(html, /<form[^>]*action="\/app\/clients"/);
    assert.match(html, /role="search"/);
    assert.match(html, />Search clients</);
    assert.match(html, />Client type</);
    assert.match(html, />Status</);
    assert.match(html, /name="q"[^>]*value="Needle"/);
    assert.match(html, /<option value="business" selected/);
    assert.match(html, /<option value="archived" selected/);
    assert.match(html, /Apply filters/);
    assert.match(html, />Reset</);
  });

  it('keeps the searchable directory authenticated and noindex', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let path = indexHref({ q: 'private' });

    let anonymous = await router.fetch(new URL(path, origin));
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('Location'), routes.auth.login.index.href());

    let html = await getHtml(router, path, sessionCookie);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<title>Clients \| My Remix App<\/title>/);
  });

  it('treats percent and underscore as literal search characters', async () => {
    let sessionCookie = await createUserAndLogin(router, 'search');
    let percentMatch = await createClient({
      type: 'business',
      legal_name: `${unique('Percent')} 100% Cotton`,
    });
    let percentOther = await createClient({
      type: 'business',
      legal_name: `${unique('Percent')} 100X Cotton`,
    });
    let underscoreMatch = await createClient({
      type: 'individual',
      legal_name: `${unique('Underscore')} Under_score`,
    });
    let underscoreOther = await createClient({
      type: 'individual',
      legal_name: `${unique('Underscore')} UnderXscore`,
    });

    let percentHtml = await getHtml(router, indexHref({ q: '100%' }), sessionCookie);
    includes(percentHtml, percentMatch.legal_name);
    assert.ok(!percentHtml.includes(percentOther.legal_name), '% should be literal');

    let underscoreHtml = await getHtml(router, indexHref({ q: 'Under_score' }), sessionCookie);
    includes(underscoreHtml, underscoreMatch.legal_name);
    assert.ok(!underscoreHtml.includes(underscoreOther.legal_name), '_ should be literal');
  });
});
