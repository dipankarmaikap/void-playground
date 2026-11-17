import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { addDays } from '../../../data/invoice-dates.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { seedInvoice } from '../../../../test/invoice-fixtures.ts';
import type { InvoiceFixture as SeedInvoiceFixture } from '../../../../test/invoice-fixtures.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  origin,
} from '../../../../test/http.ts';

interface InvoiceFixture extends SeedInvoiceFixture {
  invoiceDate: string;
  createdAt: number;
}

function indexHref(params: Record<string, string> = {}): string {
  return Object.keys(params).length === 0
    ? routes.app.invoices.index.href()
    : routes.app.invoices.index.href({}, { searchParams: params });
}

function invoiceLinks(html: string, fixtures: InvoiceFixture[]): string[] {
  return fixtures
    .filter((fixture) => html.includes(`href="/app/invoices/${fixture.id}"`))
    .sort(
      (first, second) =>
        html.indexOf(`href="/app/invoices/${first.id}"`) -
        html.indexOf(`href="/app/invoices/${second.id}"`),
    )
    .map((fixture) => fixture.id);
}

describe('invoice directory pagination', () => {
  it('renders bounded pages ordered by invoice date, creation time, then id', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-pages',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Directory Client ${crypto.randomUUID()}`,
    });
    let fixtures: InvoiceFixture[] = [
      {
        id: 'invoice-date-newest',
        recipientName: 'Newest invoice date',
        invoiceDate: '2026-03-03',
        createdAt: 1,
      },
      {
        id: 'invoice-created-newest',
        recipientName: 'Newest creation time',
        invoiceDate: '2026-03-02',
        createdAt: 9,
      },
      {
        id: 'invoice-created-earlier',
        recipientName: 'Earlier creation time',
        invoiceDate: '2026-03-02',
        createdAt: 8,
      },
      {
        id: 'invoice-id-a',
        recipientName: 'Tie id A',
        invoiceDate: '2026-03-01',
        createdAt: 7,
      },
      {
        id: 'invoice-id-z',
        recipientName: 'Tie id Z',
        invoiceDate: '2026-03-01',
        createdAt: 7,
      },
    ];
    for (let number = 1; number <= 40; number += 1) {
      fixtures.push({
        id: `invoice-page-${String(number).padStart(2, '0')}`,
        recipientName: `Paged invoice ${String(number).padStart(2, '0')}`,
        invoiceDate: addDays('2026-01-01', number),
        createdAt: number,
      });
    }
    for (let fixture of fixtures) await seedInvoice(organizationId, client.id, fixture);

    let first = await getHtml(router, indexHref(), sessionCookie);
    let second = await getHtml(router, indexHref({ page: '2' }), sessionCookie);
    let third = await getHtml(router, indexHref({ page: '3' }), sessionCookie);

    let firstPageIds = invoiceLinks(first, fixtures);
    assert.deepEqual(
      firstPageIds,
      [
        'invoice-date-newest',
        'invoice-created-newest',
        'invoice-created-earlier',
        'invoice-id-a',
        'invoice-id-z',
        ...Array.from({ length: 15 }, (_, index) =>
          `invoice-page-${String(40 - index).padStart(2, '0')}`,
        ),
      ],
      `first page links: ${firstPageIds.join(', ')}`,
    );
    assert.equal(invoiceLinks(second, fixtures).length, 20);
    assert.deepEqual(invoiceLinks(second, fixtures).slice(0, 2), [
      'invoice-page-25',
      'invoice-page-24',
    ]);
    assert.equal(invoiceLinks(third, fixtures).length, 5);
    assert.deepEqual(invoiceLinks(third, fixtures), [
      'invoice-page-05',
      'invoice-page-04',
      'invoice-page-03',
      'invoice-page-02',
      'invoice-page-01',
    ]);

    assert.match(first, />Page 1</);
    assert.match(second, />Previous<\/a>/);
    assert.match(second, />Page 2</);
    assert.match(second, />Next<\/a>/);
    assert.match(third, />Page 3</);
    assert.doesNotMatch(third, />Next<\/a>/);
  });

  it('normalizes invalid and unsafe page numbers to the first page', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-invalid-page',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Page Client ${crypto.randomUUID()}`,
    });
    let fixture: InvoiceFixture = {
      id: 'invoice-invalid-page',
      recipientName: 'Page normalization invoice',
      invoiceDate: '2026-04-01',
      createdAt: 1,
    };
    await seedInvoice(organizationId, client.id, fixture);

    for (let page of ['0', '-1', 'not-a-page', '9007199254740991']) {
      let html = await getHtml(router, indexHref({ page }), sessionCookie);
      assert.deepEqual(invoiceLinks(html, [fixture]), [fixture.id]);
      assert.doesNotMatch(html, />Previous<\/a>/);
    }
  });
});

describe('invoice directory search', () => {
  it('matches Draft recipient legal names case-insensitively', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-search',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Search Client ${crypto.randomUUID()}`,
    });
    let token = `Recipient${crypto.randomUUID().replaceAll('-', '')}`;
    let matching: InvoiceFixture = {
      id: 'invoice-search-match',
      recipientName: `Draft recipient ${token}`,
      invoiceDate: '2026-05-01',
      createdAt: 1,
    };
    let unrelated: InvoiceFixture = {
      id: 'invoice-search-unrelated',
      recipientName: 'An unrelated Draft recipient',
      invoiceDate: '2026-05-02',
      createdAt: 2,
    };
    await seedInvoice(organizationId, client.id, matching);
    await seedInvoice(organizationId, client.id, unrelated);

    let html = await getHtml(router, indexHref({ q: token.toUpperCase() }), sessionCookie);

    assert.match(html, new RegExp(matching.recipientName));
    assert.doesNotMatch(html, new RegExp(unrelated.recipientName));
    assert.deepEqual(invoiceLinks(html, [matching, unrelated]), [matching.id]);
  });

  it('matches percent and underscore literally across invoice search pages', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-literal-search',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Literal Search Client ${crypto.randomUUID()}`,
    });
    let percentMatches: InvoiceFixture[] = [];
    for (let number = 1; number <= 25; number += 1) {
      percentMatches.push({
        id: `invoice-literal-percent-${String(number).padStart(2, '0')}`,
        recipientName: `Literal ${String(number).padStart(2, '0')} 100% Cotton`,
        invoiceDate: addDays('2026-06-01', number),
        createdAt: number,
      });
    }
    let percentLookalike: InvoiceFixture = {
      id: 'invoice-literal-percent-lookalike',
      recipientName: 'Literal 100X Cotton',
      invoiceDate: '2026-06-30',
      createdAt: 30,
    };
    let underscoreMatch: InvoiceFixture = {
      id: 'invoice-literal-underscore-match',
      recipientName: 'Literal Under_score Match',
      invoiceDate: '2026-06-30',
      createdAt: 31,
    };
    let underscoreLookalike: InvoiceFixture = {
      id: 'invoice-literal-underscore-lookalike',
      recipientName: 'Literal UnderXscore Match',
      invoiceDate: '2026-06-30',
      createdAt: 32,
    };
    for (let fixture of [
      ...percentMatches,
      percentLookalike,
      underscoreMatch,
      underscoreLookalike,
    ]) {
      await seedInvoice(organizationId, client.id, fixture);
    }

    let firstPercentPage = await getHtml(router, indexHref({ q: '100%' }), sessionCookie);
    let secondPercentPage = await getHtml(
      router,
      indexHref({ q: '100%', page: '2' }),
      sessionCookie,
    );
    let underscorePage = await getHtml(
      router,
      indexHref({ q: 'Under_score' }),
      sessionCookie,
    );

    assert.equal(invoiceLinks(firstPercentPage, percentMatches).length, 20);
    assert.deepEqual(
      invoiceLinks(firstPercentPage, percentMatches).slice(0, 2),
      ['invoice-literal-percent-25', 'invoice-literal-percent-24'],
    );
    assert.equal(invoiceLinks(secondPercentPage, percentMatches).length, 5);
    assert.deepEqual(invoiceLinks(secondPercentPage, percentMatches), [
      'invoice-literal-percent-05',
      'invoice-literal-percent-04',
      'invoice-literal-percent-03',
      'invoice-literal-percent-02',
      'invoice-literal-percent-01',
    ]);
    assert.doesNotMatch(firstPercentPage, /100X Cotton/);
    assert.deepEqual(invoiceLinks(underscorePage, [underscoreMatch, underscoreLookalike]), [
      underscoreMatch.id,
    ]);
  });
});

describe('invoice directory filters', () => {
  it('filters Drafts by inclusive invoice-date range and safely handles invalid filters', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-filters',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Filter Client ${crypto.randomUUID()}`,
    });
    let fixtures: InvoiceFixture[] = [
      {
        id: 'invoice-filter-before',
        recipientName: 'Before range',
        invoiceDate: '2026-06-30',
        createdAt: 1,
      },
      {
        id: 'invoice-filter-from',
        recipientName: 'At range start',
        invoiceDate: '2026-07-01',
        createdAt: 2,
      },
      {
        id: 'invoice-filter-middle',
        recipientName: 'Inside range',
        invoiceDate: '2026-07-15',
        createdAt: 3,
      },
      {
        id: 'invoice-filter-to',
        recipientName: 'At range end',
        invoiceDate: '2026-07-31',
        createdAt: 4,
      },
      {
        id: 'invoice-filter-after',
        recipientName: 'After range',
        invoiceDate: '2026-08-01',
        createdAt: 5,
      },
    ];
    for (let fixture of fixtures) await seedInvoice(organizationId, client.id, fixture);

    let range = await getHtml(
      router,
      indexHref({ status: 'draft', from: '2026-07-01', to: '2026-07-31' }),
      sessionCookie,
    );
    let invalidDate = await getHtml(
      router,
      indexHref({ from: '2026-02-30' }),
      sessionCookie,
    );
    let invalidStatus = await getHtml(
      router,
      indexHref({ status: 'not-a-status!' }),
      sessionCookie,
    );
    let futureStatus = await getHtml(router, indexHref({ status: 'issued' }), sessionCookie);
    let reversedRange = await getHtml(
      router,
      indexHref({ from: '2026-08-01', to: '2026-06-30' }),
      sessionCookie,
    );

    assert.deepEqual(invoiceLinks(range, fixtures), [
      'invoice-filter-to',
      'invoice-filter-middle',
      'invoice-filter-from',
    ]);
    assert.equal(invoiceLinks(invalidDate, fixtures).length, fixtures.length);
    assert.equal(invoiceLinks(invalidStatus, fixtures).length, fixtures.length);
    assert.match(invalidStatus, /<option value="all" selected/);
    assert.deepEqual(invoiceLinks(futureStatus, fixtures), []);
    assert.match(futureStatus, /<option value="issued" selected>Issued<\/option>/);
    assert.deepEqual(invoiceLinks(reversedRange, fixtures), []);
  });

  it('renders accessible GET filters and keeps them while paginating', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-directory-filter-form',
    );
    let client = await createClient(organizationId, {
      type: 'individual',
      legal_name: `Filter Form Client ${crypto.randomUUID()}`,
    });
    let token = `FilterBatch${crypto.randomUUID().replaceAll('-', '')}`;
    for (let number = 1; number <= 25; number += 1) {
      await seedInvoice(organizationId, client.id, {
        id: `invoice-filter-form-${String(number).padStart(2, '0')}`,
        recipientName: `${token} invoice ${String(number).padStart(2, '0')}`,
        invoiceDate: addDays('2026-09-01', number),
        createdAt: number,
      });
    }

    let html = await getHtml(
      router,
      indexHref({
        clientId: client.id,
        q: token,
        status: 'draft',
        from: '2026-09-01',
        to: '2026-09-30',
        page: '1',
      }),
      sessionCookie,
    );
    let nextHref = /<a\b[^>]*href="([^"]+)"[^>]*>Next<\/a>/.exec(html)?.[1];
    assert.ok(nextHref, 'the filtered first page should provide a Next link');
    let nextUrl = new URL(nextHref!.replaceAll('&amp;', '&'), origin);

    assert.match(html, /<form[^>]*method="get"/);
    assert.match(html, /<form[^>]*action="\/app\/invoices"/);
    assert.match(html, /role="search"/);
    assert.match(html, new RegExp(`name="clientId"[^>]*value="${client.id}"`));
    assert.match(html, />Search invoices</);
    assert.match(html, />Status</);
    assert.match(html, /name="q"[^>]*value="FilterBatch/);
    assert.match(html, /<option value="draft" selected/);
    assert.match(html, /name="from"[^>]*value="2026-09-01"/);
    assert.match(html, /name="to"[^>]*value="2026-09-30"/);
    assert.match(html, /Apply filters/);
    assert.match(html, />Reset</);
    assert.equal(nextUrl.searchParams.get('clientId'), client.id);
    assert.equal(nextUrl.searchParams.get('q'), token);
    assert.equal(nextUrl.searchParams.get('status'), 'draft');
    assert.equal(nextUrl.searchParams.get('from'), '2026-09-01');
    assert.equal(nextUrl.searchParams.get('to'), '2026-09-30');
    assert.equal(nextUrl.searchParams.get('page'), '2');
  });
});

describe('invoice directory Organization scope', () => {
  it('does not list or search another Organization’s invoices', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'invoice-directory-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-directory-scope-other');
    let ownClient = await createClient(owner.organizationId, {
      type: 'individual',
      legal_name: `Owner Client ${crypto.randomUUID()}`,
    });
    let foreignClient = await createClient(other.organizationId, {
      type: 'individual',
      legal_name: `Foreign Client ${crypto.randomUUID()}`,
    });
    let ownInvoice: InvoiceFixture = {
      id: 'invoice-directory-own',
      recipientName: 'Owner Organization invoice',
      invoiceDate: '2026-11-01',
      createdAt: 1,
    };
    let foreignInvoice: InvoiceFixture = {
      id: 'invoice-directory-foreign',
      recipientName: 'Foreign Organization invoice',
      invoiceDate: '2026-11-02',
      createdAt: 2,
    };
    await seedInvoice(owner.organizationId, ownClient.id, ownInvoice);
    await seedInvoice(other.organizationId, foreignClient.id, foreignInvoice);

    let ownerDirectory = await getHtml(router, indexHref(), owner.sessionCookie);
    let foreignNameSearch = await getHtml(
      router,
      indexHref({ q: 'Foreign Organization invoice' }),
      owner.sessionCookie,
    );
    let foreignClientFilter = await getHtml(
      router,
      indexHref({ clientId: foreignClient.id }),
      owner.sessionCookie,
    );
    let otherDirectory = await getHtml(router, indexHref(), other.sessionCookie);

    assert.deepEqual(invoiceLinks(ownerDirectory, [ownInvoice, foreignInvoice]), [ownInvoice.id]);
    assert.deepEqual(invoiceLinks(foreignNameSearch, [foreignInvoice]), []);
    assert.deepEqual(invoiceLinks(foreignClientFilter, [foreignInvoice]), []);
    assert.deepEqual(invoiceLinks(otherDirectory, [ownInvoice, foreignInvoice]), [
      foreignInvoice.id,
    ]);
  });
});
