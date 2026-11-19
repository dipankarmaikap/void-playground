import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { db, organizationGstRatePresets } from '../../../../data/db.ts';
import '../../../../../test/db-setup.ts';
import { router } from '../../../../router.ts';
import { routes } from '../../../../routes.ts';
import {
  createUserAndLoginWithOrganization,
  getHtml,
  origin,
  postForm,
} from '../../../../../test/http.ts';

async function presetsFor(organizationId: string) {
  let rows = await db.findMany(organizationGstRatePresets, {
    where: { organization_id: organizationId },
  });
  return rows.map((row) => row.rate).sort();
}

const SEED_RATES = ['0', '12', '18', '28', '5'];

/** The inline update form belongs to exactly one preset and ends at its first `</form>`. */
function inlineUpdateForm(html: string, presetId: string): string {
  let marker = `name="preset_id" value="${presetId}"`;
  let start = html.indexOf(marker);
  assert.ok(start >= 0, 'the inline update row should be rendered');
  return html.slice(start, html.indexOf('</form>', start));
}

describe('organization GST rate presets', () => {
  it('seeds the standard editable presets for a new Organization', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-seed',
    );

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /GST rate presets/);
    for (let rate of ['0', '5', '12', '18', '28']) {
      assert.match(html, new RegExp(`name="rate"[^>]*value="${rate}"`), `shows the ${rate}% preset`);
    }
    assert.deepEqual(await presetsFor(organizationId), SEED_RATES);
  });

  it('adds a custom non-negative decimal preset', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-add',
    );

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_add', rate: ' 12.50 ' },
      sessionCookie,
    );

    assert.equal(response.status, 302);
    assert.deepEqual(await presetsFor(organizationId), [...SEED_RATES, '12.5'].sort());

    let html = await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    assert.match(html, /name="rate"[^>]*value="12.5"/);
  });

  it('edits a preset rate and removes another', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-edit',
    );
    await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    let rows = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: organizationId },
    });
    let five = rows.find((row) => row.rate === '5');
    let twelve = rows.find((row) => row.rate === '12');
    assert.ok(five);
    assert.ok(twelve);

    let edited = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_update', preset_id: five.id, rate: '6' },
      sessionCookie,
    );
    assert.equal(edited.status, 302);
    assert.equal((await db.find(organizationGstRatePresets, five.id))?.rate, '6');

    let removed = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_remove', preset_id: twelve.id },
      sessionCookie,
    );
    assert.equal(removed.status, 302);
    assert.equal(await db.find(organizationGstRatePresets, twelve.id), null);
    assert.deepEqual(await presetsFor(organizationId), ['0', '18', '28', '6'].sort());
  });

  it('restores the standard presets when the last custom preset is removed', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-remove-last',
    );
    let rows = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: organizationId },
    });
    for (let preset of rows) {
      let removed = await postForm(
        router,
        routes.app.settings.invoicing.action.href(),
        { _form: 'preset_remove', preset_id: preset.id },
        sessionCookie,
      );
      assert.equal(removed.status, 302);
    }
    assert.deepEqual(
      await presetsFor(organizationId),
      SEED_RATES,
      'default presets are restored in the removal mutation rather than a later GET',
    );
  });

  it('rejects invalid or duplicate rates with accessible 400s that preserve the draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-invalid',
    );

    for (let [rate, message] of [
      ['-1', /Enter a percentage from 0 to 100\./],
      ['101', /Enter a percentage from 0 to 100\./],
      ['abc', /Enter a valid percentage such as 18 or 12\.5\./],
      ['18', /A GST rate preset of 18% already exists\./],
    ] as const) {
      let response = await postForm(
        router,
        routes.app.settings.invoicing.action.href(),
        { _form: 'preset_add', rate },
        sessionCookie,
      );
      assert.equal(response.status, 400, `${rate} should be rejected`);
      let html = await response.text();
      assert.match(html, message);
      assert.match(html, new RegExp(`name="rate"[^>]*value="${rate.replace('.', '\\.')}"`));
      assert.match(html, /name="rate"[^>]*aria-invalid="true"/);
    }
    assert.deepEqual(await presetsFor(organizationId), SEED_RATES);
  });

  it('keeps each Organization’s presets private and ignores a forged Organization id', async () => {
    let owner = await createUserAndLoginWithOrganization(router, 'preset-owner');
    let other = await createUserAndLoginWithOrganization(router, 'preset-other');

    let added = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_add', rate: '7.5', organization_id: other.organizationId },
      owner.sessionCookie,
    );
    assert.equal(added.status, 302);

    let ownerRows = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: owner.organizationId },
    });
    let custom = ownerRows.find((row) => row.rate === '7.5');
    assert.ok(custom, 'the forged Organization id was ignored');

    let otherPage = await getHtml(
      router,
      routes.app.settings.invoicing.index.href(),
      other.sessionCookie,
    );
    assert.doesNotMatch(otherPage, /name="rate"[^>]*value="7.5"/);
    assert.deepEqual(await presetsFor(other.organizationId), SEED_RATES);

    let foreignUpdate = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_update', preset_id: custom.id, rate: '9' },
      other.sessionCookie,
    );
    assert.equal(foreignUpdate.status, 404);
    assert.equal((await db.find(organizationGstRatePresets, custom.id))?.rate, '7.5');

    let foreignRemove = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_remove', preset_id: custom.id },
      other.sessionCookie,
    );
    assert.equal(foreignRemove.status, 404);
    assert.ok(await db.find(organizationGstRatePresets, custom.id));
  });

  it('keeps the attempted value on the inline row when a duplicate preset update is rejected', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-update-duplicate',
    );
    await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    let rows = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: organizationId },
    });
    let five = rows.find((row) => row.rate === '5');
    let eighteen = rows.find((row) => row.rate === '18');
    assert.ok(five);
    assert.ok(eighteen);

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_update', preset_id: five.id, rate: '18' },
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p[^>]*role="alert"[^>]*>A GST rate preset of 18% already exists\.<\/p>/);

    let editedRow = inlineUpdateForm(html, five.id);
    assert.match(editedRow, /name="rate"[^>]*aria-invalid="true"/);
    assert.match(editedRow, /name="rate"[^>]*value="18"/);
    assert.doesNotMatch(inlineUpdateForm(html, eighteen.id), /aria-invalid="true"/);

    assert.equal((await db.find(organizationGstRatePresets, five.id))?.rate, '5');
  });

  it('keeps an out-of-range rate on the inline row when a preset update is rejected', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-update-invalid',
    );
    await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    let rows = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: organizationId },
    });
    let five = rows.find((row) => row.rate === '5');
    assert.ok(five);

    let response = await postForm(
      router,
      routes.app.settings.invoicing.action.href(),
      { _form: 'preset_update', preset_id: five.id, rate: '101' },
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p[^>]*role="alert"[^>]*>Enter a percentage from 0 to 100\.<\/p>/);

    let editedRow = inlineUpdateForm(html, five.id);
    assert.match(editedRow, /name="rate"[^>]*aria-invalid="true"/);
    assert.match(editedRow, /name="rate"[^>]*value="101"/);
    assert.equal((await db.find(organizationGstRatePresets, five.id))?.rate, '5');
  });

  it('rejects preset mutations without a CSRF token', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'preset-csrf',
    );
    await getHtml(router, routes.app.settings.invoicing.index.href(), sessionCookie);
    let response = await router.fetch(new URL(routes.app.settings.invoicing.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body: new URLSearchParams({ _form: 'preset_add', rate: '3' }).toString(),
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await presetsFor(organizationId), SEED_RATES);
  });

  it('does not contact an external registry to verify PAN or GSTIN', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'tax-no-lookup');
    let originalFetch = globalThis.fetch;
    let externalCalls: string[] = [];
    globalThis.fetch = ((input: string | URL | Request) => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) externalCalls.push(url);
      return originalFetch(input);
    }) as typeof fetch;
    try {
      let response = await postForm(
        router,
        routes.app.settings.invoicing.action.href(),
        {
          legal_name: 'Acme Studios LLP',
          address_line1: '12 Residency Road',
          address_country: 'IN',
          pan: 'AAPCS2319F',
          gst_registered: 'on',
          gstin: '27AAPCS2319F1Z5',
          gst_state_code: '27',
        },
        sessionCookie,
      );
      assert.equal(response.status, 302);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(externalCalls, []);
  });
});
