import { beforeEach, describe, it } from 'remix/test';
import * as assert from 'remix/assert';

import { clients, invoices } from '../../../data/db.ts';
import { clearTestTables } from '../../../../test/db-setup.ts';
import type { ClientType } from '../../../data/client-names.ts';
import { listClients } from '../../../data/clients.ts';
import { createTestRouter } from '../../../../test/router.ts';
import { routes } from '../../../routes.ts';
import { createUserAndLoginWithOrganization, getHtml, origin } from '../../../../test/http.ts';

const { router, db } = await createTestRouter();

let organizationId: string;

async function createPageUser() {
  let tenant = await createUserAndLoginWithOrganization(router, db, 'client-page');
  organizationId = tenant.organizationId;
  return tenant.sessionCookie;
}

function indexHref(params: Record<string, string> = {}) {
  return Object.keys(params).length === 0
    ? routes.app.clients.index.href()
    : routes.app.clients.index.href({}, { searchParams: params });
}

async function seedClient(input: {
  id: string;
  legalName: string;
  type?: ClientType;
  status?: 'active' | 'archived';
}) {
  let now = Date.now();
  return db.create(
    clients,
    {
      id: input.id,
      organization_id: organizationId,
      type: input.type ?? 'individual',
      legal_name: input.legalName,
      status: input.status ?? 'active',
      archived_at: input.status === 'archived' ? now : null,
      created_at: now,
      updated_at: now,
    },
    { returnRow: true },
  );
}

function clientItemCount(html: string) {
  let body = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/);
  return body ? (body[1].match(/<tr\b/g)?.length ?? 0) : 0;
}

function nextHref(html: string): string {
  let href = /<a\b[^>]*href="([^"]+)"[^>]*>Next<\/a>/.exec(html)?.[1];
  assert.ok(href, 'the page should provide a Next link');
  return href;
}

beforeEach(async () => {
  await clearTestTables(db, invoices, clients);
});

describe('Client directory pagination', () => {
  it('returns bounded, stable pages ordered by legal name and id', async () => {
    let sessionCookie = await createPageUser();
    for (let number = 1; number <= 45; number += 1) {
      await seedClient({
        id: String(number).padStart(3, '0'),
        legalName: `Paged Client ${String(number).padStart(3, '0')}`,
      });
    }
    let first = await getHtml(router, indexHref(), sessionCookie);
    assert.equal(clientItemCount(first), 20);
    assert.ok(first.includes('Paged Client 001'));
    assert.ok(first.includes('Paged Client 020'));
    assert.ok(!first.includes('Paged Client 021'));

    let directory = await listClients(db, organizationId);
    assert.equal(directory.clients.length, 20);
    assert.ok(directory.clients[0]);
    for (let field of ['tax_value', 'billing_line1', 'created_at']) {
      assert.equal(
        Object.hasOwn(directory.clients[0], field),
        false,
        `${field} is not needed to render or search the directory`,
      );
    }

    let second = await getHtml(router, indexHref({ page: '2' }), sessionCookie);
    assert.equal(clientItemCount(second), 20);
    assert.ok(second.includes('Paged Client 021'));
    assert.ok(second.includes('Paged Client 040'));
    assert.ok(!second.includes('Paged Client 041'));
    assert.match(second, />Previous<\/a>/);

    let third = await getHtml(router, indexHref({ page: '3' }), sessionCookie);
    assert.equal(clientItemCount(third), 5);
    assert.ok(third.includes('Paged Client 041'));
    assert.ok(third.includes('Paged Client 045'));
    assert.doesNotMatch(third, />Next<\/a>/);
  });

  it('uses Client id as a stable tie-breaker for equal legal names', async () => {
    let sessionCookie = await createPageUser();
    await seedClient({ id: 'z-tie', legalName: 'Tie Break Client' });
    await seedClient({ id: 'a-tie', legalName: 'Tie Break Client' });

    let html = await getHtml(router, indexHref(), sessionCookie);
    assert.ok(html.indexOf('/app/clients/a-tie') < html.indexOf('/app/clients/z-tie'));
  });

  it('preserves search, type, and status while moving between pages', async () => {
    let sessionCookie = await createPageUser();
    let query = `Paged Batch ${crypto.randomUUID()}`;

    for (let number = 1; number <= 25; number += 1) {
      await seedClient({
        id: `archived-business-${String(number).padStart(2, '0')}`,
        legalName: `${query} ${String(number).padStart(2, '0')}`,
        type: 'business',
        status: 'archived',
      });
    }
    await seedClient({
      id: 'active-business-distractor',
      legalName: `${query} active distractor`,
      type: 'business',
    });
    await seedClient({
      id: 'archived-individual-distractor',
      legalName: `${query} individual distractor`,
      status: 'archived',
    });

    let params = { q: query, type: 'business', status: 'archived' };
    let first = await getHtml(router, indexHref({ ...params, page: '1' }), sessionCookie);
    assert.equal(clientItemCount(first), 20);
    assert.ok(first.includes(`${query} 01`));
    assert.ok(!first.includes(`${query} 21`));
    assert.ok(!first.includes('active distractor'));
    assert.ok(!first.includes('individual distractor'));

    let nextUrl = new URL(nextHref(first).replaceAll('&amp;', '&'), origin);
    assert.equal(nextUrl.searchParams.get('q'), query);
    assert.equal(nextUrl.searchParams.get('type'), 'business');
    assert.equal(nextUrl.searchParams.get('status'), 'archived');
    assert.equal(nextUrl.searchParams.get('page'), '2');

    let second = await getHtml(router, `${nextUrl.pathname}${nextUrl.search}`, sessionCookie);
    assert.equal(clientItemCount(second), 5);
    assert.ok(second.includes(`${query} 21`));
    assert.ok(second.includes(`${query} 25`));
    assert.ok(!second.includes('active distractor'));
    assert.ok(!second.includes('individual distractor'));
  });

  it('paginates literal wildcard searches without matching wildcard lookalikes', async () => {
    let sessionCookie = await createPageUser();
    for (let number = 1; number <= 25; number += 1) {
      await seedClient({
        id: `literal-${String(number).padStart(2, '0')}`,
        legalName: `Literal ${String(number).padStart(2, '0')} 100% Match`,
      });
    }
    await seedClient({ id: 'wildcard-distractor', legalName: 'Literal 100X Match' });

    let first = await getHtml(router, indexHref({ q: '100%' }), sessionCookie);
    assert.equal(clientItemCount(first), 20);
    assert.ok(first.includes('Literal 01 100% Match'));
    assert.ok(first.includes('Literal 20 100% Match'));
    assert.ok(!first.includes('Literal 21 100% Match'));
    assert.ok(!first.includes('100X Match'));

    let nextUrl = new URL(nextHref(first).replaceAll('&amp;', '&'), origin);
    assert.equal(nextUrl.searchParams.get('q'), '100%');
    let second = await getHtml(router, `${nextUrl.pathname}${nextUrl.search}`, sessionCookie);
    assert.equal(clientItemCount(second), 5);
    assert.ok(second.includes('Literal 21 100% Match'));
    assert.ok(second.includes('Literal 25 100% Match'));
    assert.ok(!second.includes('100X Match'));
  });

  it('normalizes invalid page numbers to the first page', async () => {
    let sessionCookie = await createPageUser();
    await seedClient({ id: 'only-client', legalName: 'Only Client' });

    for (let page of ['0', '-1', 'not-a-page']) {
      let html = await getHtml(router, indexHref({ page }), sessionCookie);
      assert.equal(clientItemCount(html), 1);
      assert.ok(html.includes('Only Client'));
      assert.doesNotMatch(html, />Previous<\/a>/);
    }
  });
});
