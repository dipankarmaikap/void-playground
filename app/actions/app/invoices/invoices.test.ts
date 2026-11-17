import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { db, organizationGstRatePresets } from '../../../data/db.ts';
import {
  parseInvoicingProfile,
  saveInvoicingProfile,
} from '../../../data/organization-invoicing.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import {
  createUserAndLogin,
  createUserAndLoginWithOrganization,
  extractCsrf,
  getHtml,
  origin,
  submitForm,
} from '../../../../test/http.ts';

type DraftFields = Record<string, string | string[] | undefined>;

async function submitDraft(
  pageUrl: string,
  actionUrl: string,
  fields: DraftFields,
  cookie: string,
): Promise<Response> {
  let page = await router.fetch(new URL(pageUrl, origin), {
    headers: { Cookie: cookie },
  });
  let csrf = extractCsrf(await page.text());
  let body = new URLSearchParams();
  for (let [name, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((entry) => body.append(name, entry));
    else body.append(name, value);
  }
  body.append('_csrf', csrf);
  return router.fetch(new URL(actionUrl, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: body.toString(),
  });
}

function draftFields(clientId: string, overrides: DraftFields = {}): DraftFields {
  let today = expectedToday();
  return {
    client_id: clientId,
    currency: 'INR',
    invoice_date: today,
    due_date: today,
    payment_term: 'due_on_receipt',
    custom_payment_terms: '',
    recipient_legal_name: 'Draft Recipient',
    recipient_billing_line1: '1 Draft Street',
    recipient_billing_locality: 'Bengaluru',
    recipient_billing_region: 'Karnataka',
    recipient_billing_postal_code: '560001',
    recipient_billing_country: 'IN',
    recipient_tax_country: 'IN',
    recipient_tax_type: 'gstin',
    recipient_tax_value: '27AAPCS2319F1Z5',
    recipient_tax_state_code: '27',
    payment_instructions: 'Pay by bank transfer',
    customer_notes: 'Thank you',
    internal_note: 'Private billing context',
    line_description: ['Consulting services'],
    line_sac: ['998313'],
    line_quantity: ['1.5'],
    line_unit_price: ['100.0000'],
    ...overrides,
  };
}

async function createDraft(
  cookie: string,
  clientId: string,
  overrides: DraftFields = {},
): Promise<Response> {
  return submitDraft(
    newDraftPath(clientId),
    routes.app.invoices.new.action.href(),
    draftFields(clientId, overrides),
    cookie,
  );
}

function draftIdFrom(response: Response): string {
  let location = response.headers.get('Location');
  assert.ok(location, 'creation should redirect to the draft');
  return new URL(location, origin).pathname.split('/').at(-1)!;
}

function unique(prefix: string): string {
  return `${prefix} ${crypto.randomUUID()}`;
}

async function setInvoicingDefaults(
  organizationId: string,
  overrides: Record<string, string> = {},
): Promise<void> {
  let parsed = parseInvoicingProfile({
    legal_name: 'Default Studio',
    address_line1: '1 Default Street',
    address_country: 'IN',
    invoice_prefix: 'INV',
    credit_note_prefix: 'CN',
    invoice_starting_number: '1',
    credit_note_starting_number: '1',
    ...overrides,
  });
  assert.equal(parsed.ok, true, 'the test defaults should be valid');
  if (parsed.ok) await saveInvoicingProfile(organizationId, parsed.value);
}

async function makeClient(organizationId: string, overrides: Record<string, unknown> = {}) {
  return createClient(organizationId, {
    type: 'individual',
    legal_name: unique('Draft Client'),
    billing_line1: '12 Residency Road',
    billing_locality: 'Bengaluru',
    billing_country: 'IN',
    tax_country: 'IN',
    tax_type: 'gstin',
    tax_value: '27AAPCS2319F1Z5',
    tax_state_code: '27',
    status: 'active',
    ...overrides,
  });
}

function expectedToday(): string {
  let parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  let part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function expectedDueDate(invoiceDate: string, days: number): string {
  let [year, month, day] = invoiceDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function newDraftPath(clientId: string): string {
  return routes.app.invoices.new.index.href({}, { searchParams: { clientId } });
}

describe('draft invoices', () => {
  it('exposes the Invoices destination in the authenticated navigation', async () => {
    let sessionCookie = await createUserAndLogin(router, 'invoice-nav');
    let html = await getHtml(router, routes.app.dashboard.href(), sessionCookie);

    assert.match(html, /<nav aria-label="Main"[\s\S]*?Invoices[\s\S]*?<\/nav>/);
    assert.match(
      html,
      new RegExp(`<a[^>]*href="${routes.app.invoices.index.href()}"[^>]*>[\\s\\S]*?Invoices`),
      'the Invoices link should point at the invoice directory',
    );
  });

  it('renders an Organization-scoped invoice directory for a signed-in User', async () => {
    let { sessionCookie } = await createUserAndLoginWithOrganization(router, 'invoice-index');
    let html = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);

    assert.match(html, /<h1[^>]*>Invoices<\/h1>/);
    assert.match(html, /<a[^>]*href="\/app\/invoices\/new"/);
    assert.match(html, /No invoices yet\./);
    assert.match(html, /<a[^>]*href="\/app\/invoices"[^>]*aria-current="page"/);
  });

  it('keeps invoice form GET requests read-only for GST presets', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-get-read-only',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id);
    assert.equal(created.status, 302);

    let presets = await db.findMany(organizationGstRatePresets, {
      where: { organization_id: organizationId },
    });
    for (let preset of presets) await db.delete(organizationGstRatePresets, preset.id);

    for (let path of [
      newDraftPath(client.id),
      routes.app.invoices.edit.index.href({ invoiceId: draftIdFrom(created) }),
    ]) {
      let response = await router.fetch(new URL(path, origin), {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(response.status, 200);
      await response.text();
      assert.equal(
        await db.count(organizationGstRatePresets, {
          where: { organization_id: organizationId },
        }),
        0,
        `${path} must not seed GST presets while rendering`,
      );
    }
  });

  it('redirects anonymous visitors from the invoice directory to login', async () => {
    let response = await router.fetch(new URL(routes.app.invoices.index.href(), origin));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
  });

  it('prefills recipient, currency, dates, and notes from the Client and Organization defaults', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-prefill',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'net_15',
      payment_instructions: 'Pay by bank transfer',
      customer_notes: 'Thank you for your business',
    });
    let client = await makeClient(organizationId, { billing_currency: 'USD' });

    let html = await getHtml(router, newDraftPath(client.id), sessionCookie);

    assert.match(html, /<h1[^>]*>New invoice draft<\/h1>/);
    assert.match(html, new RegExp(`name="client_id"[^>]*value="${client.id}"`));
    assert.match(
      html,
      new RegExp(`name="recipient_legal_name"[^>]*value="${client.legal_name}"`),
    );
    assert.match(html, /name="recipient_billing_line1"[^>]*value="12 Residency Road"/);
    assert.match(html, /name="recipient_billing_locality"[^>]*value="Bengaluru"/);
    assert.match(html, /name="recipient_billing_country"[^>]*value="IN"/);
    assert.match(html, /name="recipient_tax_value"[^>]*value="27AAPCS2319F1Z5"/);
    assert.match(html, /name="recipient_tax_type"[^>]*value="gstin"/);

    let today = expectedToday();
    assert.match(html, new RegExp(`name="invoice_date"[^>]*value="${today}"`));
    assert.match(html, new RegExp(`name="due_date"[^>]*value="${expectedDueDate(today, 15)}"`));
    assert.match(html, /name="currency"[^>]*value="USD"/, 'the Client currency wins');
    assert.match(html, /<textarea[^>]*name="payment_instructions"[^>]*>Pay by bank transfer<\/textarea>/);
    assert.match(html, /<textarea[^>]*name="customer_notes"[^>]*>Thank you for your business<\/textarea>/);
    assert.match(html, /<textarea[^>]*name="internal_note"[^>]*>\s*<\/textarea>/);
    assert.match(html, /<option value="net_15"[^>]*selected/);
  });

  it('preserves the Client India tax State/UT name on the Draft without trusting a forged value', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-tax-state',
    );
    let client = await makeClient(organizationId, { tax_state_name: 'Maharashtra' });

    let page = await getHtml(router, newDraftPath(client.id), sessionCookie);
    assert.match(
      page,
      /name="recipient_tax_state_name"[^>]*value="Maharashtra"/,
      'the Client tax State/UT name should be prefilled',
    );

    let created = await createDraft(sessionCookie, client.id, {
      recipient_tax_state_name: 'Forged State',
      recipient_tax_state_code: '27',
    });
    assert.equal(created.status, 302);
    let id = draftIdFrom(created);

    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(detail, /Tax State\/UT: Maharashtra/);
    assert.ok(!detail.includes('Forged State'));
  });

  it('falls back to Organization currency and term when the Client has no default currency', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-fallback',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'JPY',
      payment_term: 'net_30',
    });
    let client = await makeClient(organizationId, { billing_currency: null });

    let html = await getHtml(router, newDraftPath(client.id), sessionCookie);
    let today = expectedToday();

    assert.match(html, /name="currency"[^>]*value="JPY"/);
    assert.match(html, new RegExp(`name="due_date"[^>]*value="${expectedDueDate(today, 30)}"`));
  });

  it('defaults Place of Supply from the Client and calculates intra-state GST after discounts', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-domestic-gst',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let client = await makeClient(organizationId, {
      tax_country: 'IN',
      tax_state_code: '27',
      tax_state_name: 'Maharashtra',
    });

    let page = await getHtml(router, newDraftPath(client.id), sessionCookie);
    assert.match(page, /name="gst_mode"[\s\S]*?<option value="india_gst" selected/);
    assert.match(page, /name="place_of_supply_state_code"[\s\S]*?<option value="27" selected/);
    assert.match(page, /name="line_tax_treatment"/);
    assert.match(page, /value="18"/);

    let created = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: 'on',
      recipient_tax_value: '27AAPCS2319F1Z5',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
      line_discount_mode: ['percent'],
      line_discount_value: ['10'],
    });
    assert.equal(created.status, 302);
    let id = draftIdFrom(created);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(detail, /Place of Supply: Maharashtra/);
    assert.match(detail, /CGST @ 9%/);
    assert.match(detail, /SGST @ 9%/);
    assert.match(detail, /12\.15 INR/);
    let lineTable = detail.slice(detail.indexOf('<tbody>'), detail.indexOf('</tbody>'));
    assert.match(lineTable, /CGST @ 9%: 12\.15 INR/);
    assert.match(detail, /Total tax: 24\.30 INR/);
    assert.match(detail, /Total: 159\.30 INR/);
    let edit = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(edit, /CGST @ 9%: 12\.15 INR/);
  });

  it('gates GST for unregistered Organizations and allows no-tax Drafts', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-gst-disabled',
    );
    let client = await makeClient(organizationId);
    let page = await getHtml(router, newDraftPath(client.id), sessionCookie);
    assert.doesNotMatch(page, /aria-labelledby="invoice-gst-heading"/);

    let rejectedMode = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(rejectedMode.status, 400);
    assert.match(await rejectedMode.text(), /GST is available only when your Organization/i);

    let rejectedLine = await createDraft(sessionCookie, client.id, {
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(rejectedLine.status, 400);
    assert.match(await rejectedLine.text(), /GST line treatments require Indian GST mode/i);

    let noTax = await createDraft(sessionCookie, client.id, { gst_mode: 'none' });
    assert.equal(noTax.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: draftIdFrom(noTax) }),
      sessionCookie,
    );
    assert.match(detail, /Total: 150\.00 INR/);
    assert.doesNotMatch(detail, /IGST|CGST|SGST/);
  });

  it('applies multiple GST slabs after invoice discounts and groups zero-tax treatments', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-gst-slabs',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: '',
      line_description: ['Eighteen percent', 'Twelve percent', 'Nil-rated service', 'Exempt service', 'Non-GST service'],
      line_quantity: ['1', '1', '1', '1', '1'],
      line_unit_price: ['1000', '1000', '100', '100', '100'],
      line_tax_treatment: ['taxable', 'taxable', 'nil_rated', 'exempt', 'non_gst'],
      line_gst_rate: ['18', '12', '', '', ''],
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '100',
    });
    assert.equal(created.status, 302);
    let id = draftIdFrom(created);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Subtotal: 2,300\.00 INR/);
    assert.match(detail, /Invoice discount \(fixed\): 100\.00 INR/);
    assert.match(detail, /Net taxable subtotal: 2,200\.00 INR/);
    assert.match(detail, /CGST @ 9%: 86\.09 INR/);
    assert.match(detail, /SGST @ 9%: 86\.08 INR/);
    assert.match(detail, /CGST @ 6%: 57\.39 INR/);
    assert.match(detail, /SGST @ 6%: 57\.39 INR/);
    assert.match(detail, /Total tax: 286\.95 INR/);
    assert.match(detail, /Total: 2,486\.95 INR/);
    assert.match(detail, /nil-rated: 0%/);
    assert.match(detail, /exempt: 0%/);
    assert.match(detail, /non-gst: 0%/);

    let edit = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(edit, /Current GST summary/);
    assert.match(edit, /CGST @ 9%: 86\.09 INR/);
    assert.match(edit, /SGST @ 6%: 57\.39 INR/);
  });

  it('defaults Place of Supply from Indian billing region and permits an inter-state override', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-gst-place-override',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let billingClient = await makeClient(organizationId, {
      tax_country: null,
      tax_type: null,
      tax_value: null,
      tax_state_name: null,
      tax_state_code: null,
      billing_country: 'IN',
      billing_region: 'Karnataka',
    });
    let billingPage = await getHtml(router, newDraftPath(billingClient.id), sessionCookie);
    assert.match(
      billingPage,
      /name="place_of_supply_state_code"[\s\S]*?<option value="29" selected/,
    );

    let client = await makeClient(organizationId);
    let page = await getHtml(router, newDraftPath(client.id), sessionCookie);
    assert.match(
      page,
      /name="place_of_supply_state_code"[\s\S]*?<option value="27" selected/,
    );
    let created = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '29',
      recipient_gstin_applicable: 'on',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(created.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: draftIdFrom(created) }),
      sessionCookie,
    );
    assert.match(detail, /Place of Supply: Karnataka/);
    assert.match(detail, /IGST @ 18%/);
    assert.match(detail, /27\.00 INR/);
    assert.doesNotMatch(detail, /CGST @|SGST @/);

    let missingTaxId = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: '',
      recipient_tax_value: '',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(missingTaxId.status, 302);
    let invalidTaxId = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: 'on',
      recipient_tax_value: 'not-a-gstin',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(invalidTaxId.status, 400);
    assert.match(await invalidTaxId.text(), /valid 15-character Indian GSTIN or UIN/i);
    let uin = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      recipient_gstin_applicable: 'on',
      recipient_tax_type: 'uin',
      recipient_tax_value: '123456789012345',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(uin.status, 302);
  });

  it('refuses new drafts for Archived and foreign-Organization Clients', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-archived');
    let client = await makeClient(first.organizationId);
    let archived = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.archive.href({ clientId: client.id }),
      {},
      first.sessionCookie,
    );
    assert.equal(archived.status, 302);
    let archivedProfile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: client.id }),
      first.sessionCookie,
    );
    assert.match(archivedProfile, /Status[\s\S]*?Archived/);

    let archivedResponse = await router.fetch(new URL(newDraftPath(client.id), origin), {
      headers: { Cookie: first.sessionCookie },
    });
    assert.equal(archivedResponse.status, 404);
    assert.doesNotMatch(await archivedResponse.text(), /New invoice draft/);

    let second = await createUserAndLoginWithOrganization(router, 'invoice-foreign');
    let foreignClient = await makeClient(second.organizationId);
    let foreignResponse = await router.fetch(new URL(newDraftPath(foreignClient.id), origin), {
      headers: { Cookie: first.sessionCookie },
    });
    assert.equal(foreignResponse.status, 404);
    assert.ok(!(await foreignResponse.text()).includes(foreignClient.legal_name));
  });

  it('creates a Draft with exact line totals and no final invoice number', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-create',
    );
    let client = await makeClient(organizationId);

    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting', 'Support'],
      line_sac: ['998313', ''],
      line_quantity: ['1.5', '2'],
      line_unit_price: ['100.0000', '12.3456'],
    });

    assert.equal(response.status, 302);
    let id = draftIdFrom(response);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Status: Draft/);
    assert.match(detail, /Draft Recipient/);
    assert.match(detail, /Currency: INR/);
    assert.match(detail, /Billing address: 1 Draft Street/);
    assert.match(detail, /Subtotal: 174\.69 INR/);
    assert.match(detail, /Total: 174\.69 INR/);
    assert.match(detail, /Internal note \(private\): Private billing context/);
    assert.ok(detail.indexOf('Consulting') < detail.indexOf('Support'));
    assert.match(detail, /Consulting[\s\S]*?998313[\s\S]*?1\.5[\s\S]*?100[\s\S]*?150\.00 INR/);
    assert.match(detail, /Support[\s\S]*?2[\s\S]*?12\.3456[\s\S]*?24\.69 INR/);

    let html = await getHtml(router, routes.app.clients.show.href({ clientId: client.id }), sessionCookie);
    assert.ok(html.includes(client.legal_name));
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /Draft Recipient/);
    assert.match(directory, /Draft · 2026-11-17 · 174\.69 INR/);
    assert.ok(directory.includes(id), 'the Draft is visible in the invoice directory');
  });

  it('applies a per-line percentage discount and reconciles the subtotal breakdown', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-line-percent',
    );
    let client = await makeClient(organizationId);

    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting', 'Support'],
      line_sac: ['998313', ''],
      line_quantity: ['1.5', '2'],
      line_unit_price: ['100.0000', '12.3456'],
      line_discount_mode: ['percent', ''],
      line_discount_value: ['10', ''],
    });

    assert.equal(response.status, 302);
    let id = draftIdFrom(response);

    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Subtotal: 174\.69 INR/);
    assert.match(html, /Line discounts: 15\.00 INR/);
    assert.match(html, /Net taxable subtotal: 159\.69 INR/);
    assert.match(html, /Total: 159\.69 INR/);
    assert.match(html, /Consulting[\s\S]*?10% · 15\.00 INR[\s\S]*?135\.00 INR/);
    assert.match(html, /Support[\s\S]*?24\.69 INR/);
  });

  it('applies a fixed per-line discount and rejects discounts above the line gross', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-line-fixed',
    );
    let client = await makeClient(organizationId);

    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting', 'Support'],
      line_quantity: ['2', '1'],
      line_unit_price: ['50.0000', '10.0000'],
      line_discount_mode: ['fixed', ''],
      line_discount_value: ['25.50', ''],
    });
    assert.equal(response.status, 302);
    let id = draftIdFrom(response);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Subtotal: 110\.00 INR/);
    assert.match(html, /Line discounts: 25\.50 INR/);
    assert.match(html, /Net taxable subtotal: 84\.50 INR/);
    assert.match(html, /Total: 84\.50 INR/);
    assert.match(html, /Consulting[\s\S]*?25\.50 INR[\s\S]*?74\.50 INR/);
    assert.match(html, /Support[\s\S]*?10\.00 INR/);

    let invalid = [
      {
        mode: 'fixed',
        value: '100.01',
        message: /discount cannot exceed the line amount/i,
        preserved: /name="line_discount_value"[^>]*value="100\.01"/,
      },
      {
        mode: 'percent',
        value: '100.01',
        message: /cannot exceed 100%/i,
        preserved: /name="line_discount_value"[^>]*value="100\.01"/,
      },
      {
        mode: 'fixed',
        value: '-1',
        message: /non-negative discount/i,
        preserved: /name="line_discount_value"[^>]*value="-1"/,
      },
    ];
    for (let { mode, value, message, preserved } of invalid) {
      let rejected = await createDraft(sessionCookie, client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['50.0000'],
        line_discount_mode: [mode],
        line_discount_value: [value],
      });
      assert.equal(rejected.status, 400);
      let rejectedHtml = await rejected.text();
      assert.match(rejectedHtml, /Please correct the fields below\./);
      assert.match(rejectedHtml, message);
      assert.match(rejectedHtml, preserved);
    }
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.equal((directory.match(/Draft Recipient/g) ?? []).length, 1);
  });

  it('allocates an invoice-wide percentage discount across uneven lines by largest remainder', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-percent-allocate',
    );
    let client = await makeClient(organizationId);

    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Large', 'Medium', 'Small'],
      line_quantity: ['1', '1', '1'],
      line_unit_price: ['100.0000', '50.0000', '0.0300'],
      invoice_discount_mode: ['percent'],
      invoice_discount_value: ['33.3333'],
    });
    assert.equal(response.status, 302);
    let id = draftIdFrom(response);

    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Invoice discount \(percent\): 50\.01 INR/);
    assert.match(html, /Net taxable subtotal: 100\.02 INR/);
    assert.match(html, /Total: 100\.02 INR/);
    assert.match(html, /Large[\s\S]*?100\.00 INR[\s\S]*?66\.67 INR/);
    assert.match(html, /Medium[\s\S]*?50\.00 INR[\s\S]*?33\.33 INR/);
    assert.match(html, /Small[\s\S]*?0\.03 INR[\s\S]*?0\.02 INR/);
  });

  it('applies a fixed invoice discount on post-line-discount values and rejects over-discounts', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-fixed-allocate',
    );
    let client = await makeClient(organizationId);
    let fields = {
      line_description: ['Consulting', 'Support'],
      line_quantity: ['2', '1'],
      line_unit_price: ['100.0000', '50.0000'],
      line_discount_mode: ['percent', 'fixed'],
      line_discount_value: ['25', '5.00'],
      invoice_discount_mode: ['fixed'],
      invoice_discount_value: ['12.34'],
    };

    let response = await createDraft(sessionCookie, client.id, fields);
    assert.equal(response.status, 302);
    let id = draftIdFrom(response);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Subtotal: 250\.00 INR/);
    assert.match(html, /Line discounts: 55\.00 INR/);
    assert.match(html, /Invoice discount \(fixed\): 12\.34 INR/);
    assert.match(html, /Net taxable subtotal: 182\.66 INR/);
    assert.match(html, /Total: 182\.66 INR/);
    assert.match(html, /Consulting[\s\S]*?50\.00 INR[\s\S]*?140\.51 INR/);
    assert.match(html, /Support[\s\S]*?5\.00 INR[\s\S]*?42\.15 INR/);

    let tooLarge = await createDraft(sessionCookie, client.id, {
      ...fields,
      invoice_discount_value: ['200.00'],
    });
    assert.equal(tooLarge.status, 400);
    let rejectedHtml = await tooLarge.text();
    assert.match(rejectedHtml, /discount cannot exceed the post-discount subtotal/i);
    assert.match(rejectedHtml, /name="invoice_discount_value"[^>]*value="200\.00"/);

    let badPercent = await createDraft(sessionCookie, client.id, {
      ...fields,
      invoice_discount_mode: ['percent'],
      invoice_discount_value: ['101'],
    });
    assert.equal(badPercent.status, 400);
    assert.match(await badPercent.text(), /cannot exceed 100%/);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.equal((directory.match(/Draft Recipient/g) ?? []).length, 1);
  });

  it('applies a positive round-off to the nearest whole currency unit', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-round-off-positive',
    );
    let client = await makeClient(organizationId);
    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting'],
      line_quantity: ['1.5'],
      line_unit_price: ['100.0000'],
      invoice_discount_mode: ['fixed'],
      invoice_discount_value: ['0.05'],
      round_off: ['0.05'],
    });
    assert.equal(response.status, 302);

    let id = draftIdFrom(response);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Net taxable subtotal: 149\.95 INR/);
    assert.match(html, /Round-off: 0\.05 INR/);
    assert.match(html, /Total: 150\.00 INR/);
  });

  it('rounds exact halfway totals away from zero', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-round-off-halfway',
    );
    let client = await makeClient(organizationId);
    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Halfway amount'],
      line_quantity: ['1'],
      line_unit_price: ['149.50'],
      round_off: ['0.50'],
    });
    assert.equal(response.status, 302);

    let id = draftIdFrom(response);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(detail, /Net taxable subtotal: 149\.50 INR/);
    assert.match(detail, /Round-off: 0\.50 INR/);
    assert.match(detail, /Total: 150\.00 INR/);
  });

  it('applies a negative round-off to the nearest whole currency unit', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-round-off-negative',
    );
    let client = await makeClient(organizationId);
    let response = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting'],
      line_quantity: ['1'],
      line_unit_price: ['150.07'],
      round_off: ['-0.07'],
    });
    assert.equal(response.status, 302);

    let id = draftIdFrom(response);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Net taxable subtotal: 150\.07 INR/);
    assert.match(html, /Round-off: -0\.07 INR/);
    assert.match(html, /Total: 150\.00 INR/);
  });

  it('rejects round-off amounts that do not produce the nearest whole currency unit', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-round-off-invalid',
    );
    let client = await makeClient(organizationId);
    let fields = {
      line_description: ['Consulting'],
      line_quantity: ['1.5'],
      line_unit_price: ['100.0000'],
      invoice_discount_mode: ['fixed'],
      invoice_discount_value: ['0.05'],
    };

    for (let roundOff of ['0.04', '-0.07']) {
      let rejected = await createDraft(sessionCookie, client.id, {
        ...fields,
        round_off: [roundOff],
      });
      assert.equal(rejected.status, 400);
      let rejectedHtml = await rejected.text();
      assert.match(rejectedHtml, /nearest whole currency unit/i);
      assert.match(
        rejectedHtml,
        new RegExp(`name="round_off"[^>]*value="${roundOff.replace('-', '\\-')}"`),
      );
    }

    let malformed = await createDraft(sessionCookie, client.id, {
      ...fields,
      round_off: ['abc'],
    });
    assert.equal(malformed.status, 400);
    assert.match(await malformed.text(), /signed round-off amount/i);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /No invoices yet\./);
  });

  it('round-trips discounts and round-off through the edit form', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-round-trip',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(
      await createDraft(sessionCookie, client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['percent'],
        line_discount_value: ['10'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['5.05'],
        round_off: ['0.05'],
      }),
    );

    let editPage = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(
      editPage,
      /name="line_discount_mode"[^>]*>[\s\S]*?<option value="percent" selected/,
    );
    assert.match(editPage, /name="line_discount_value"[^>]*value="10"/);
    assert.match(
      editPage,
      /name="invoice_discount_mode"[^>]*>[\s\S]*?<option value="fixed" selected/,
    );
    assert.match(editPage, /name="invoice_discount_value"[^>]*value="5\.05"/);
    assert.match(editPage, /name="round_off"[^>]*value="0\.05"/);
  });

  it('preserves unsaved discount and round-off values when adding a line', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-add-line',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(
      await createDraft(sessionCookie, client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['percent'],
        line_discount_value: ['10'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['5.05'],
        round_off: ['0.05'],
      }),
    );
    let fields = draftFields(client.id, {
      line_description: ['Consulting', ''],
      line_quantity: ['2', ''],
      line_unit_price: ['100.0000', ''],
      line_discount_mode: ['fixed', ''],
      line_discount_value: ['7.50', ''],
      invoice_discount_mode: ['percent'],
      invoice_discount_value: ['10'],
      round_off: ['-0.25'],
    });
    let added = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      { ...fields, _intent: 'add_line' },
      sessionCookie,
    );
    assert.equal(added.status, 200);
    let addedHtml = await added.text();
    assert.equal((addedHtml.match(/name="line_description"/g) ?? []).length, 3);
    assert.match(addedHtml, /name="line_discount_value"[^>]*value="7\.50"/);
    assert.match(addedHtml, /name="invoice_discount_value"[^>]*value="10"/);
    assert.match(addedHtml, /name="round_off"[^>]*value="-0\.25"/);

    let savedEditPage = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(savedEditPage, /name="line_discount_value"[^>]*value="10"/);
    assert.match(savedEditPage, /name="invoice_discount_value"[^>]*value="5\.05"/);
    assert.match(savedEditPage, /name="round_off"[^>]*value="0\.05"/);
  });

  it('preserves submitted discount and round-off values after validation errors', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-validation',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(
      await createDraft(sessionCookie, client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['percent'],
        line_discount_value: ['10'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['5.05'],
        round_off: ['0.05'],
      }),
    );
    let fields = draftFields(client.id, {
      line_description: ['Consulting'],
      line_quantity: ['2'],
      line_unit_price: ['100.0000'],
      line_discount_mode: ['fixed'],
      line_discount_value: ['201'],
      invoice_discount_mode: ['percent'],
      invoice_discount_value: ['10'],
      round_off: ['-0.25'],
    });
    let invalid = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      fields,
      sessionCookie,
    );
    assert.equal(invalid.status, 400);
    let invalidHtml = await invalid.text();
    assert.match(invalidHtml, /discount cannot exceed the line amount/i);
    assert.match(invalidHtml, /name="line_discount_value"[^>]*value="201"/);
    assert.match(invalidHtml, /name="round_off"[^>]*value="-0\.25"/);
  });

  it('saves edited discounts and round-off on the Draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-save',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(
      await createDraft(sessionCookie, client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['percent'],
        line_discount_value: ['10'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['5.05'],
        round_off: ['0.05'],
      }),
    );
    let updated = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, {
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['fixed'],
        line_discount_value: ['7.50'],
        invoice_discount_mode: ['percent'],
        invoice_discount_value: ['10'],
        round_off: ['-0.25'],
      }),
      sessionCookie,
    );
    assert.equal(updated.status, 302);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Line discounts: 7\.50 INR/);
    assert.match(detail, /Invoice discount \(percent\): 19\.25 INR/);
    assert.match(detail, /Net taxable subtotal: 173\.25 INR/);
    assert.match(detail, /Round-off: -0\.25 INR/);
    assert.match(detail, /Total: 173\.00 INR/);
  });

  it('keeps discount fields scoped to the Organization and protected by CSRF', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-discount-scope-first');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-discount-scope-other');
    let ownClient = await makeClient(first.organizationId);
    let id = draftIdFrom(
      await createDraft(first.sessionCookie, ownClient.id, {
        line_description: ['Consulting'],
        line_quantity: ['1'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['percent'],
        line_discount_value: ['10'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['5.00'],
        round_off: ['0'],
      }),
    );
    let before = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), first.sessionCookie);

    let foreignEdit = await submitDraft(
      routes.app.dashboard.href(),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(ownClient.id, {
        line_discount_mode: ['fixed'],
        line_discount_value: ['99'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: ['99'],
        round_off: ['99'],
      }),
      other.sessionCookie,
    );
    assert.equal(foreignEdit.status, 404);
    let after = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), first.sessionCookie);
    assert.match(before, /Line discounts: 10\.00 INR/);
    assert.match(before, /Invoice discount \(fixed\): 5\.00 INR/);
    assert.match(before, /Total: 85\.00 INR/);
    assert.match(after, /Line discounts: 10\.00 INR/);
    assert.match(after, /Invoice discount \(fixed\): 5\.00 INR/);
    assert.match(after, /Round-off: 0\.00 INR/);
    assert.match(after, /Total: 85\.00 INR/);

    let csrfFields = draftFields(ownClient.id, {
      line_discount_mode: 'percent',
      line_discount_value: '10',
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '5.00',
      round_off: '0',
    });
    let body = new URLSearchParams();
    for (let [name, value] of Object.entries(csrfFields)) {
      if (Array.isArray(value)) value.forEach((entry) => body.append(name, entry));
      else if (value != null) body.append(name, value);
    }
    let noCsrf = await router.fetch(new URL(routes.app.invoices.new.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: first.sessionCookie,
      },
      body: body.toString(),
    });
    assert.equal(noCsrf.status, 403);
    let ownDirectory = await getHtml(router, routes.app.invoices.index.href(), first.sessionCookie);
    assert.equal((ownDirectory.match(/Draft Recipient/g) ?? []).length, 1);
    let otherDirectory = await getHtml(router, routes.app.invoices.index.href(), other.sessionCookie);
    assert.match(otherDirectory, /No invoices yet\./);
  });

  it('applies ISO 4217 minor-unit precision for INR, USD, JPY, XAF, and KWD', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-precision',
    );
    let client = await makeClient(organizationId);
    let expected = [
      { currency: 'INR', text: '1.23 INR' },
      { currency: 'USD', text: '1.23 USD' },
      { currency: 'JPY', text: '1 JPY' },
      { currency: 'XAF', text: '1 XAF' },
      { currency: 'KWD', text: '1.235 KWD' },
    ];

    for (let { currency, text } of expected) {
      let response = await createDraft(sessionCookie, client.id, {
        currency,
        line_quantity: ['1'],
        line_unit_price: ['1.2345'],
      });
      assert.equal(response.status, 302, `${currency} should be accepted`);
      let id = draftIdFrom(response);
      let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
      assert.ok(html.includes(text), `${currency} should render ${text}`);
    }
  });

  it('respects zero-, two-, and three-minor-unit currencies for discounts and round-off', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-precision',
    );
    let client = await makeClient(organizationId);
    let cases = [
      {
        currency: 'INR',
        price: '1.2345',
        invoiceDiscount: '0.01',
        roundOff: '0.40',
        subtotalText: '1.23 INR',
        lineDiscountText: '0.62 INR',
        invoiceDiscountText: '0.01 INR',
        netSubtotalText: '0.60 INR',
        totalText: '1.00 INR',
        roundOffText: '0.40 INR',
      },
      {
        currency: 'USD',
        price: '1.2345',
        invoiceDiscount: '0.01',
        roundOff: '0.40',
        subtotalText: '1.23 USD',
        lineDiscountText: '0.62 USD',
        invoiceDiscountText: '0.01 USD',
        netSubtotalText: '0.60 USD',
        totalText: '1.00 USD',
        roundOffText: '0.40 USD',
      },
      {
        currency: 'JPY',
        price: '3.0000',
        invoiceDiscount: '1',
        roundOff: '0',
        subtotalText: '3 JPY',
        lineDiscountText: '2 JPY',
        invoiceDiscountText: '1 JPY',
        netSubtotalText: '0 JPY',
        totalText: '0 JPY',
        roundOffText: '0 JPY',
      },
      {
        currency: 'KWD',
        price: '1.2345',
        invoiceDiscount: '0.001',
        roundOff: '0.384',
        subtotalText: '1.235 KWD',
        lineDiscountText: '0.618 KWD',
        invoiceDiscountText: '0.001 KWD',
        netSubtotalText: '0.616 KWD',
        totalText: '1.000 KWD',
        roundOffText: '0.384 KWD',
      },
    ];

    for (let item of cases) {
      let response = await createDraft(sessionCookie, client.id, {
        currency: item.currency,
        line_description: ['Precision line'],
        line_quantity: ['1'],
        line_unit_price: [item.price],
        line_discount_mode: ['percent'],
        line_discount_value: ['50'],
        invoice_discount_mode: ['fixed'],
        invoice_discount_value: [item.invoiceDiscount],
        round_off: [item.roundOff],
      });
      assert.equal(response.status, 302, `${item.currency} draft should be accepted`);
      let id = draftIdFrom(response);
      let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
      assert.ok(html.includes(`Subtotal: ${item.subtotalText}`));
      assert.ok(html.includes(`Line discounts: ${item.lineDiscountText}`));
      assert.ok(html.includes(`Invoice discount (fixed): ${item.invoiceDiscountText}`));
      assert.ok(html.includes(`Net taxable subtotal: ${item.netSubtotalText}`));
      assert.ok(html.includes(`Round-off: ${item.roundOffText}`));
      assert.ok(html.includes(`Total: ${item.totalText}`));
    }
  });

  it('applies recipient overrides to the Draft only, never to the saved Client', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-override',
    );
    let client = await makeClient(organizationId, {
      billing_line1: '12 Original Road',
      billing_locality: 'Original City',
      tax_value: '27AAPCS2319F1Z5',
    });

    let response = await createDraft(sessionCookie, client.id, {
      recipient_legal_name: 'Override Recipient',
      recipient_billing_line1: '99 Override Street',
      recipient_billing_locality: 'New City',
      recipient_tax_value: '09ZZZ9999Z1Z5',
    });
    assert.equal(response.status, 302);

    let id = draftIdFrom(response);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Recipient: Override Recipient/);
    assert.match(detail, /Billing address: 99 Override Street/);
    assert.match(detail, /Tax identifier: GSTIN 09ZZZ9999Z1Z5/);

    let clientProfile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: client.id }),
      sessionCookie,
    );
    assert.ok(clientProfile.includes(client.legal_name));
    assert.match(clientProfile, /12 Original Road/);
    assert.match(clientProfile, /Original City/);
    assert.match(clientProfile, /27AAPCS2319F1Z5/);
  });

  it('adds service lines through a no-JS server intent and saves four or more lines', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-add-line',
    );
    let client = await makeClient(organizationId);
    let threeLines = {
      line_description: ['First', 'Second', 'Third'],
      line_quantity: ['1', '2', '3'],
      line_unit_price: ['10.0000', '20.0000', '30.0000'],
    };

    let added = await submitDraft(
      newDraftPath(client.id),
      routes.app.invoices.new.action.href(),
      draftFields(client.id, { ...threeLines, _intent: 'add_line' }),
      sessionCookie,
    );
    assert.equal(added.status, 200, 'the add-line intent re-renders the form');
    let addedHtml = await added.text();
    assert.equal((addedHtml.match(/name="line_description"/g) ?? []).length, 4);
    assert.match(addedHtml, /name="line_description"[^>]*value="First"/);
    assert.match(addedHtml, /name="line_description"[^>]*value="Third"/);
    assert.match(addedHtml, /name="_intent" value="add_line"[^>]*>Add another line</);
    let emptyDirectory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(emptyDirectory, /No invoices yet\./);

    let created = await createDraft(sessionCookie, client.id, {
      line_description: ['First', 'Second', 'Third', 'Fourth'],
      line_quantity: ['1', '2', '3', '4'],
      line_unit_price: ['10.0000', '20.0000', '30.0000', '40.0000'],
    });
    assert.equal(created.status, 302);
    let id = draftIdFrom(created);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.ok(detail.indexOf('First') < detail.indexOf('Second'));
    assert.ok(detail.indexOf('Second') < detail.indexOf('Third'));
    assert.ok(detail.indexOf('Third') < detail.indexOf('Fourth'));
    assert.match(detail, /Total: 300\.00 INR/);
  });

  it('adds a line while editing without mutating the Draft until saved', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-edit-add-line',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(await createDraft(sessionCookie, client.id));

    let added = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, {
        _intent: 'add_line',
        line_description: ['Consulting services', '', ''],
        line_quantity: ['1.5', '', ''],
        line_unit_price: ['100.0000', '', ''],
      }),
      sessionCookie,
    );
    assert.equal(added.status, 200);
    let html = await added.text();
    assert.equal((html.match(/name="line_description"/g) ?? []).length, 4);
    assert.match(html, /name="line_description"[^>]*value="Consulting services"/);
    let savedEditPage = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.equal((savedEditPage.match(/name="line_description"/g) ?? []).length, 3);
    assert.match(savedEditPage, /name="line_description"[^>]*value="Consulting services"/);
    let savedDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(savedDetail, /Total: 150\.00 INR/);
  });

  it('rejects invalid lines with 400 responses that preserve what was submitted', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-invalid-lines',
    );
    let client = await makeClient(organizationId);
    let invalid = [
      {
        fields: { line_quantity: ['0'], line_unit_price: ['10'] },
        message: /positive quantity/,
        preserved: /name="line_quantity"[^>]*value="0"/,
      },
      {
        fields: { line_quantity: ['-1'], line_unit_price: ['10'] },
        message: /positive quantity/,
        preserved: /name="line_quantity"[^>]*value="-1"/,
      },
      {
        fields: { line_quantity: ['1.23456'], line_unit_price: ['10'] },
        message: /at most 4 decimal places/,
        preserved: /name="line_quantity"[^>]*value="1\.23456"/,
      },
      {
        fields: { line_quantity: ['1'], line_unit_price: ['-2'] },
        message: /non-negative unit price/,
        preserved: /name="line_unit_price"[^>]*value="-2"/,
      },
      {
        fields: { line_description: [''], line_quantity: ['1'], line_unit_price: ['10'] },
        message: /Enter a service description/,
        preserved: /name="line_quantity"[^>]*value="1"/,
      },
      {
        fields: {
          line_description: [''],
          line_sac: [''],
          line_quantity: [''],
          line_unit_price: [''],
        },
        message: /at least one service line/,
        preserved: /name="recipient_legal_name"[^>]*value="Draft Recipient"/,
      },
    ];

    for (let { fields, message, preserved } of invalid) {
      let response = await createDraft(sessionCookie, client.id, fields);
      assert.equal(response.status, 400);
      let html = await response.text();
      assert.match(html, /Please correct the fields below\./);
      assert.match(html, message);
      assert.match(html, preserved);
    }
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /No invoices yet\./);
  });

  it('rejects a discount-only blank line instead of silently dropping its discount', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-only-row',
    );
    let client = await makeClient(organizationId);

    let rejected = await createDraft(sessionCookie, client.id, {
      line_description: ['Consulting', ''],
      line_sac: ['998313', ''],
      line_quantity: ['1', ''],
      line_unit_price: ['100.0000', ''],
      line_discount_mode: ['', 'percent'],
      line_discount_value: ['', '12.5'],
    });

    assert.equal(rejected.status, 400);
    let html = await rejected.text();
    assert.match(
      html,
      /id="invoice-error-summary"[^>]*tabindex="-1"[^>]*autofocus/,
    );
    assert.match(html, /Enter a service description/);
    assert.match(html, /<option value="percent" selected>Percentage<\/option>/);
    assert.match(html, /name="line_discount_value"[^>]*value="12\.5"/);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /No invoices yet\./);
  });

  it('rejects amounts outside the exact persisted numeric range without saving anything', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-money-range',
    );
    let client = await makeClient(organizationId);
    let oversized = {
      line_description: ['Huge line'],
      line_quantity: ['100000000000.0000'],
      line_unit_price: ['100000.0000'],
    };

    let created = await createDraft(sessionCookie, client.id, oversized);
    assert.equal(created.status, 400);
    assert.match(await created.text(), /too large to store exactly/i);
    let emptyDirectory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(emptyDirectory, /No invoices yet\./);

    let valid = await createDraft(sessionCookie, client.id);
    assert.equal(valid.status, 302);
    let id = draftIdFrom(valid);
    let before = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(before, /Total: 150\.00 INR/);
    let edited = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, oversized),
      sessionCookie,
    );
    assert.equal(edited.status, 400);
    assert.match(await edited.text(), /too large to store exactly/i);
    let after = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(after, /Total: 150\.00 INR/);
    assert.match(after, /Consulting services/);
    assert.doesNotMatch(after, /Huge line/);
  });

  it('validates invoice dates, due dates, and currency codes', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-dates',
    );
    let client = await makeClient(organizationId);
    let today = expectedToday();

    let tooEarly = await createDraft(sessionCookie, client.id, {
      invoice_date: today,
      due_date: expectedDueDate(today, -1),
    });
    assert.equal(tooEarly.status, 400);
    assert.match(await tooEarly.text(), /due date cannot be earlier/i);

    let badDate = await createDraft(sessionCookie, client.id, { invoice_date: '2026-02-30' });
    assert.equal(badDate.status, 400);
    assert.match(await badDate.text(), /valid invoice date/i);

    let badCurrency = await createDraft(sessionCookie, client.id, { currency: 'EURO' });
    assert.equal(badCurrency.status, 400);
    assert.match(await badCurrency.text(), /valid 3-letter ISO 4217 currency code/i);

    let unknownCurrency = await createDraft(sessionCookie, client.id, { currency: 'ZZZ' });
    assert.equal(unknownCurrency.status, 400);
    let unknownCurrencyHtml = await unknownCurrency.text();
    assert.match(unknownCurrencyHtml, /valid 3-letter ISO 4217 currency code/i);
    assert.match(unknownCurrencyHtml, /name="currency"[^>]*value="ZZZ"/);

    let custom = await createDraft(sessionCookie, client.id, {
      payment_term: 'custom',
      custom_payment_terms: 'Payable within 45 days',
      due_date: expectedDueDate(today, 45),
    });
    assert.equal(custom.status, 302);
    let customId = draftIdFrom(custom);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: customId }),
      sessionCookie,
    );
    assert.match(detail, /Payment term: Custom/);
    assert.match(detail, /Custom terms: Payable within 45 days/);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.ok(directory.includes(customId));
    assert.equal((directory.match(/Draft Recipient/g) ?? []).length, 1);
  });

  it('rejects draft mutations without a CSRF token', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-csrf',
    );
    let client = await makeClient(organizationId);
    let body = new URLSearchParams();
    for (let [name, value] of Object.entries(draftFields(client.id))) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((entry) => body.append(name, entry));
      else body.append(name, value);
    }
    let response = await router.fetch(new URL(routes.app.invoices.new.action.href(), origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookie,
      },
      body,
    });

    assert.equal(response.status, 403);
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /No invoices yet\./);
  });

  it('ignores forged Organization ids and refuses Clients from another Organization', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-scope-first');
    let second = await createUserAndLoginWithOrganization(router, 'invoice-scope-second');
    let ownClient = await makeClient(first.organizationId);
    let foreignClient = await makeClient(second.organizationId);

    let forged = await createDraft(first.sessionCookie, ownClient.id, {
      organization_id: second.organizationId,
    } as DraftFields);
    assert.equal(forged.status, 302);
    let forgedId = draftIdFrom(forged);
    let ownDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: forgedId }),
      first.sessionCookie,
    );
    assert.ok(ownDetail.includes(ownClient.legal_name));

    let foreign = await submitDraft(
      newDraftPath(ownClient.id),
      routes.app.invoices.new.action.href(),
      draftFields(foreignClient.id),
      first.sessionCookie,
    );
    assert.equal(foreign.status, 404);
    let ownDirectory = await getHtml(router, routes.app.invoices.index.href(), first.sessionCookie);
    assert.ok(ownDirectory.includes(forgedId));
    assert.doesNotMatch(ownDirectory, new RegExp(foreignClient.legal_name));
    let foreignDirectory = await getHtml(router, routes.app.invoices.index.href(), second.sessionCookie);
    assert.match(foreignDirectory, /No invoices yet\./);
  });

  it('views a Draft with its lines, totals, notes, and no final invoice number', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-show',
    );
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id);
    let id = draftIdFrom(created);

    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Status: Draft/);
    assert.doesNotMatch(html, /Invoice number:/i);
    assert.match(html, /Draft Recipient/);
    assert.match(html, /Consulting services/);
    assert.match(html, /998313/);
    assert.match(html, /150\.00 INR/);
    assert.match(html, /Pay by bank transfer/);
    assert.match(html, /Private billing context/);
    assert.match(html, /Edit draft/);
    assert.match(html, /Discard draft/);
    assert.match(
      html,
      /<details[\s\S]*?<summary[^>]*>Discard draft<\/summary>[\s\S]*?cannot be undone[\s\S]*?<form[^>]*action="\/app\/invoices\/[^"]+\/discard"[\s\S]*?name="_csrf"[\s\S]*?Confirm discard draft[\s\S]*?<\/form>[\s\S]*?<\/details>/,
      'the destructive POST should be behind an accessible no-JS confirmation',
    );

    let foreign = await createUserAndLoginWithOrganization(router, 'invoice-show-foreign');
    let response = await router.fetch(new URL(routes.app.invoices.show.href({ invoiceId: id }), origin), {
      headers: { Cookie: foreign.sessionCookie },
    });
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes(client.legal_name));
  });

  it('edits a Draft, replaces its lines, and keeps stored data intact on validation errors', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-edit',
    );
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id);
    let id = draftIdFrom(created);

    let editPage = await getHtml(router, routes.app.invoices.edit.index.href({ invoiceId: id }), sessionCookie);
    assert.match(editPage, /name="recipient_legal_name"[^>]*value="Draft Recipient"/);
    assert.match(editPage, /name="line_description"[^>]*value="Consulting services"/);
    assert.match(editPage, /name="line_quantity"[^>]*value="1.5"/);

    let invalid = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, { line_quantity: ['0'] }),
      sessionCookie,
    );
    assert.equal(invalid.status, 400);
    assert.match(await invalid.text(), /positive quantity/);
    let afterInvalid = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(afterInvalid, /Total: 150\.00 INR/);
    assert.match(afterInvalid, /Consulting services/);

    let updated = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, {
        currency: 'USD',
        recipient_legal_name: 'Edited Recipient',
        internal_note: 'Updated internal note',
        client_id: crypto.randomUUID(),
        line_description: [' rewritten line ', 'second line'],
        line_quantity: ['2', '3.5'],
        line_unit_price: ['10.0000', '4.0000'],
      }),
      sessionCookie,
    );
    assert.equal(updated.status, 302);

    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Recipient: Edited Recipient/);
    assert.ok(detail.includes(`Client: ${client.legal_name}`));
    assert.match(detail, /Currency: USD/);
    assert.match(detail, /Internal note \(private\): Updated internal note/);
    assert.match(detail, /Total: 34\.00 USD/);
    assert.ok(detail.indexOf('rewritten line') < detail.indexOf('second line'));
    assert.doesNotMatch(detail, /Consulting services/);

    let updatedEditPage = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      sessionCookie,
    );
    assert.match(updatedEditPage, new RegExp(`name="client_id"[^>]*value="${client.id}"`));
    assert.match(updatedEditPage, /name="line_description"[^>]*value="rewritten line"/);
    assert.match(updatedEditPage, /name="line_description"[^>]*value="second line"/);
  });

  it('does not let another Organization view or edit a Draft', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-edit-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-edit-scope-other');
    let client = await makeClient(first.organizationId);
    let created = await createDraft(first.sessionCookie, client.id);
    let id = draftIdFrom(created);
    let before = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      first.sessionCookie,
    );

    let show = await router.fetch(new URL(routes.app.invoices.edit.index.href({ invoiceId: id }), origin), {
      headers: { Cookie: other.sessionCookie },
    });
    assert.equal(show.status, 404);
    let showBody = await show.text();
    assert.ok(!showBody.includes('Draft Recipient'));
    assert.ok(!showBody.includes(id));

    let edit = await submitDraft(
      routes.app.dashboard.href(),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, { recipient_legal_name: 'Hacked Recipient' }),
      other.sessionCookie,
    );
    assert.equal(edit.status, 404);
    assert.ok(!(await edit.text()).includes('Hacked Recipient'));

    let after = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: id }),
      first.sessionCookie,
    );
    assert.match(before, /Recipient: Draft Recipient/);
    assert.match(before, /Total: 150\.00 INR/);
    assert.match(after, /Recipient: Draft Recipient/);
    assert.match(after, /Total: 150\.00 INR/);
    assert.match(after, /Consulting services/);
  });

  it('keeps an existing Draft accessible and editable after its Client is archived', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-archived-draft',
    );
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id);
    let id = draftIdFrom(created);
    let archived = await submitForm(
      router,
      routes.app.clients.index.href(),
      routes.app.clients.lifecycle.archive.href({ clientId: client.id }),
      {},
      sessionCookie,
    );
    assert.equal(archived.status, 302);
    let clientProfile = await getHtml(
      router,
      routes.app.clients.show.href({ clientId: client.id }),
      sessionCookie,
    );
    assert.match(clientProfile, /Status[\s\S]*?Archived/);

    let show = await router.fetch(new URL(routes.app.invoices.show.href({ invoiceId: id }), origin), {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(show.status, 200);
    assert.match(await show.text(), /Archived/);

    let editPage = await router.fetch(
      new URL(routes.app.invoices.edit.index.href({ invoiceId: id }), origin),
      { headers: { Cookie: sessionCookie } },
    );
    assert.equal(editPage.status, 200);

    let edited = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, { internal_note: 'Still editable' }),
      sessionCookie,
    );
    assert.equal(edited.status, 302);
    let detail = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(detail, /Internal note \(private\): Still editable/);
  });

  it('discards only the current Organization’s Drafts with CSRF protection', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-discard-first');
    let ownClient = await makeClient(first.organizationId);
    let firstDraft = draftIdFrom(
      await createDraft(first.sessionCookie, ownClient.id, {
        recipient_legal_name: 'Discard target recipient',
      }),
    );
    let keepDraft = draftIdFrom(
      await createDraft(first.sessionCookie, ownClient.id, {
        recipient_legal_name: 'Kept recipient',
      }),
    );
    let second = await createUserAndLoginWithOrganization(router, 'invoice-discard-second');
    let foreignClient = await makeClient(second.organizationId);
    let foreignDraft = draftIdFrom(
      await createDraft(second.sessionCookie, foreignClient.id, {
        recipient_legal_name: 'Foreign recipient',
      }),
    );

    let noCsrf = await router.fetch(
      new URL(
        routes.app.invoices.lifecycle.discard.href({ invoiceId: firstDraft }),
        origin,
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: first.sessionCookie,
        },
        body: '',
      },
    );
    assert.equal(noCsrf.status, 403);
    let targetBeforeDiscard = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: firstDraft }),
      first.sessionCookie,
    );
    assert.match(targetBeforeDiscard, /Discard target recipient/);

    let foreignDiscard = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: firstDraft }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: foreignDraft }),
      {},
      first.sessionCookie,
    );
    assert.equal(foreignDiscard.status, 404);
    let foreignAfterDeniedDiscard = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: foreignDraft }),
      second.sessionCookie,
    );
    assert.match(foreignAfterDeniedDiscard, /Foreign recipient/);

    let discarded = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: firstDraft }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: firstDraft }),
      {},
      first.sessionCookie,
    );
    assert.equal(discarded.status, 302);
    assert.equal(discarded.headers.get('Location'), routes.app.invoices.index.href());

    let directory = await getHtml(router, routes.app.invoices.index.href(), first.sessionCookie);
    assert.match(directory, /Invoice draft discarded/);
    assert.ok(!directory.includes(firstDraft), 'the discarded draft is no longer listed');
    assert.ok(directory.includes(keepDraft), 'the other draft is still listed');
    assert.ok(directory.includes('Kept recipient'));
    assert.ok(!directory.includes('Discard target recipient'));
    let missingDraft = await router.fetch(
      new URL(routes.app.invoices.show.href({ invoiceId: firstDraft }), origin),
      { headers: { Cookie: first.sessionCookie } },
    );
    assert.equal(missingDraft.status, 404);
    let keptPage = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: keepDraft }),
      first.sessionCookie,
    );
    assert.match(keptPage, /Kept recipient/);
    assert.match(foreignAfterDeniedDiscard, /Foreign recipient/);
  });

  it('renders export endorsements and discloses reverse-charge GST without collecting it', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-export-reverse-charge',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let client = await makeClient(organizationId);

    let invalidExport = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'export_igst',
      place_of_supply_country: 'IN',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(invalidExport.status, 400);
    assert.match(await invalidExport.text(), /country outside India/i);

    let lut = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'export_lut',
      place_of_supply_country: 'US',
      export_reference: 'LUT/2026-27/001',
      line_tax_treatment: ['taxable'],
      line_gst_rate: [''],
    });
    assert.equal(lut.status, 302);
    let lutDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: draftIdFrom(lut) }),
      sessionCookie,
    );
    assert.match(lutDetail, /Export under LUT\/Bond/);
    assert.match(lutDetail, /LUT\/2026-27\/001/);
    assert.match(lutDetail, /IGST @ 0%/);
    assert.match(lutDetail, /Total: 150\.00 INR/);

    let exportIgst = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'export_igst',
      place_of_supply_country: 'US',
      export_reference: 'EXP-2026-001',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(exportIgst.status, 302);
    let exportIgstId = draftIdFrom(exportIgst);
    let exportIgstDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: exportIgstId }),
      sessionCookie,
    );
    assert.match(exportIgstDetail, /Export with IGST/);
    assert.match(exportIgstDetail, /Place of Supply: United States/);
    assert.match(exportIgstDetail, /EXP-2026-001/);
    assert.match(exportIgstDetail, /IGST @ 18%/);
    assert.match(exportIgstDetail, /Total: 177\.00 INR/);
    let exportEdit = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: exportIgstId }),
      sessionCookie,
    );
    assert.match(exportEdit, /name="supply_type"[\s\S]*?<option value="export_igst" selected/);
    assert.match(exportEdit, /name="place_of_supply_country"[^>]*value="US"/);
    assert.match(exportEdit, /name="export_reference"[^>]*value="EXP-2026-001"/);

    let reverseCharge = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      supply_type: 'domestic',
      place_of_supply_state_code: '27',
      reverse_charge: 'on',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
    });
    assert.equal(reverseCharge.status, 302);
    let reverseDetail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: draftIdFrom(reverseCharge) }),
      sessionCookie,
    );
    assert.match(reverseDetail, /Reverse charge applies/);
    assert.match(reverseDetail, /CGST @ 9%/);
    assert.match(reverseDetail, /SGST @ 9%/);
    assert.match(reverseDetail, /payable by recipient/i);
    assert.match(reverseDetail, /Tax payable by recipient: 27\.00 INR/);
    assert.match(reverseDetail, /Total: 150\.00 INR/);
    let reverseEdit = await getHtml(
      router,
      routes.app.invoices.edit.index.href({ invoiceId: draftIdFrom(reverseCharge) }),
      sessionCookie,
    );
    assert.match(reverseEdit, /name="reverse_charge"[^>]*checked/);
  });

  it('calculates percentage and fixed foreign tax at USD, EUR, JPY, and KWD precision', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-manual-foreign-tax',
    );
    let client = await makeClient(organizationId);
    let cases = [
      { currency: 'USD', percentage: '7.50 USD', fixed: '2.00 USD', fixedInput: '2.00' },
      { currency: 'EUR', percentage: '7.50 EUR', fixed: '2.00 EUR', fixedInput: '2.00' },
      { currency: 'JPY', percentage: '8 JPY', fixed: '2 JPY', fixedInput: '2' },
      { currency: 'KWD', percentage: '7.500 KWD', fixed: '2.000 KWD', fixedInput: '2.000' },
    ];

    for (let { currency, percentage, fixed, fixedInput } of cases) {
      let created = await createDraft(sessionCookie, client.id, {
        currency,
        gst_mode: 'foreign_manual',
        line_description: ['Percentage-taxed service', 'Fixed-taxed service'],
        line_quantity: ['1', '1'],
        line_unit_price: ['100', '100'],
        line_foreign_tax_label: ['Sales Tax', 'Withholding/VAT'],
        line_foreign_tax_mode: ['percent', 'fixed'],
        line_foreign_tax_value: ['7.5', '2'],
      });
      assert.equal(created.status, 302, `manual tax should be accepted for ${currency}`);
      let invoiceId = draftIdFrom(created);
      let detail = await getHtml(
        router,
        routes.app.invoices.show.href({ invoiceId }),
        sessionCookie,
      );
      assert.match(detail, new RegExp(`Sales Tax @ 7\\.5%: ${percentage.replace('.', '\\.')}`));
      assert.match(detail, new RegExp(`Withholding/VAT: ${fixed.replace('.', '\\.')}`));
      assert.match(detail, /Total tax:/);
      assert.match(detail, /Total:/);
      assert.doesNotMatch(detail, /CGST|SGST|IGST/);
      let edit = await getHtml(
        router,
        routes.app.invoices.edit.index.href({ invoiceId }),
        sessionCookie,
      );
      assert.match(edit, /value="foreign_manual" selected/);
      assert.match(edit, /name="line_foreign_tax_label"[^>]*value="Sales Tax"/);
      assert.match(edit, /name="line_foreign_tax_mode"[\s\S]*?<option value="fixed" selected/);
      assert.match(edit, /name="line_foreign_tax_value"[^>]*value="7\.5"/);
      assert.match(
        edit,
        new RegExp(`name="line_foreign_tax_value"[^>]*value="${fixedInput.replace('.', '\\.')}"`),
      );
    }
  });

  it('rejects combining Indian GST and manual foreign tax on one Draft', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-mixed-tax-regimes',
    );
    await setInvoicingDefaults(organizationId, {
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      gst_registered: 'on',
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
    });
    let client = await makeClient(organizationId);

    let mixedForeignLine = await createDraft(sessionCookie, client.id, {
      gst_mode: 'india_gst',
      place_of_supply_state_code: '27',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
      line_foreign_tax_label: ['Sales Tax'],
      line_foreign_tax_mode: ['percent'],
      line_foreign_tax_value: ['5'],
    });
    assert.equal(mixedForeignLine.status, 400);
    assert.match(await mixedForeignLine.text(), /cannot combine Indian GST and manual foreign tax/i);

    let mixedGstLine = await createDraft(sessionCookie, client.id, {
      gst_mode: 'foreign_manual',
      line_tax_treatment: ['taxable'],
      line_gst_rate: ['18'],
      line_foreign_tax_label: ['Sales Tax'],
      line_foreign_tax_mode: ['percent'],
      line_foreign_tax_value: ['5'],
    });
    assert.equal(mixedGstLine.status, 400);
    assert.match(await mixedGstLine.text(), /GST line treatments require Indian GST mode/i);

    let invalidManualRate = await createDraft(sessionCookie, client.id, {
      gst_mode: 'foreign_manual',
      line_foreign_tax_label: ['Sales Tax'],
      line_foreign_tax_mode: ['percent'],
      line_foreign_tax_value: ['101'],
    });
    assert.equal(invalidManualRate.status, 400);
    assert.match(await invalidManualRate.text(), /percentage cannot exceed 100%/i);

    let manualWithoutLabel = await createDraft(sessionCookie, client.id, {
      gst_mode: 'foreign_manual',
      line_foreign_tax_label: [''],
      line_foreign_tax_mode: ['fixed'],
      line_foreign_tax_value: ['5'],
    });
    assert.equal(manualWithoutLabel.status, 400);
    let manualTaxErrors = await manualWithoutLabel.text();
    assert.match(manualTaxErrors, /Enter a label for the manual foreign tax/i);
    assert.match(
      manualTaxErrors,
      /name="line_foreign_tax_label"[^>]*aria-invalid="true"[^>]*aria-describedby="line-0-foreign-tax-label-error"/,
    );
    assert.match(
      manualTaxErrors,
      /id="line-0-foreign-tax-label-error"[^>]*>Enter a label for the manual foreign tax\./,
    );
    assert.match(
      manualTaxErrors,
      /id="invoice-error-summary"[^>]*tabindex="-1"[^>]*autofocus/,
    );
    assert.match(manualTaxErrors, /<h2[^>]*>Please correct the fields below\.<\/h2>/);
  });

  it('calculates manual percentage tax on the post-discount line value', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-manual-tax-discounts',
    );
    let client = await makeClient(organizationId);
    let created = await createDraft(sessionCookie, client.id, {
      currency: 'USD',
      gst_mode: 'foreign_manual',
      line_description: ['Discounted service'],
      line_quantity: ['1'],
      line_unit_price: ['100'],
      line_discount_mode: ['percent'],
      line_discount_value: ['10'],
      line_foreign_tax_label: ['Sales Tax'],
      line_foreign_tax_mode: ['percent'],
      line_foreign_tax_value: ['10'],
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '10',
    });
    assert.equal(created.status, 302);
    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: draftIdFrom(created) }),
      sessionCookie,
    );
    assert.match(detail, /Line discounts: 10\.00 USD/);
    assert.match(detail, /Invoice discount \(fixed\): 10\.00 USD/);
    assert.match(detail, /Net taxable subtotal: 80\.00 USD/);
    assert.match(detail, /Sales Tax @ 10%: 8\.00 USD/);
    assert.match(detail, /Total: 88\.00 USD/);
  });
});
