import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createClient } from '../../../data/clients.ts';
import { clients, db, invoiceLines, invoices } from '../../../data/db.ts';
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
    let invoice = await db.find(invoices, draftIdFrom(created));
    assert.equal(invoice?.recipient_tax_state_name, 'Maharashtra');
    assert.equal(invoice?.recipient_tax_state_code, '27');

    let detail = await getHtml(
      router,
      routes.app.invoices.show.href({ invoiceId: invoice!.id }),
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
    assert.equal((await db.find(clients, client.id))?.status, 'archived');

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
    let invoice = await db.find(invoices, id);
    assert.ok(invoice);
    assert.equal(invoice.organization_id, organizationId);
    assert.equal(invoice.client_id, client.id);
    assert.equal(invoice.status, 'draft');
    assert.equal(invoice.invoice_number, null);
    assert.equal(invoice.currency, 'INR');
    assert.equal(invoice.recipient_legal_name, 'Draft Recipient');
    assert.equal(invoice.recipient_billing_line1, '1 Draft Street');
    assert.equal(invoice.internal_note, 'Private billing context');
    assert.equal(invoice.subtotal_minor, 17469, '150.00 + 24.6912 rounds half-up to 24.69');
    assert.equal(invoice.total_minor, 17469);

    let lines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.description, 'Consulting');
    assert.equal(lines[0]?.sac, '998313');
    assert.equal(lines[0]?.quantity, '1.5');
    assert.equal(lines[0]?.unit_price, '100');
    assert.equal(lines[0]?.amount_minor, 15000);
    assert.equal(lines[1]?.description, 'Support');
    assert.equal(lines[1]?.sac, null);
    assert.equal(lines[1]?.amount_minor, 2469);
    assert.equal(lines[1]?.organization_id, organizationId);

    let html = await getHtml(router, routes.app.clients.show.href({ clientId: client.id }), sessionCookie);
    assert.ok(html.includes(client.legal_name));
    let directory = await getHtml(router, routes.app.invoices.index.href(), sessionCookie);
    assert.match(directory, /Draft Recipient/);
    assert.match(directory, /Draft · 2026-11-17 · 174\.69 INR/);
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
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.subtotal_minor, 17469);
    assert.equal(invoice?.line_discount_total_minor, 1500, '10% of 150.00 is 15.00');
    assert.equal(invoice?.invoice_discount_minor, 0);
    assert.equal(invoice?.net_subtotal_minor, 15969);
    assert.equal(invoice?.round_off_minor, 0);
    assert.equal(invoice?.total_minor, 15969);

    let lines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.equal(lines[0]?.amount_minor, 15000, 'amount stays the pre-discount gross');
    assert.equal(lines[0]?.discount_mode, 'percent');
    assert.equal(lines[0]?.discount_value, '10');
    assert.equal(lines[0]?.line_discount_minor, 1500);
    assert.equal(lines[0]?.net_minor, 13500);
    assert.equal(lines[1]?.line_discount_minor, 0);
    assert.equal(lines[1]?.net_minor, 2469);

    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Subtotal: 174\.69 INR/);
    assert.match(html, /Line discounts: 15\.00 INR/);
    assert.match(html, /Net taxable subtotal: 159\.69 INR/);
    assert.match(html, /Total: 159\.69 INR/);
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
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.subtotal_minor, 11000);
    assert.equal(invoice?.line_discount_total_minor, 2550);
    assert.equal(invoice?.net_subtotal_minor, 8450);
    assert.equal(invoice?.total_minor, 8450);
    let lines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.equal(lines[0]?.discount_mode, 'fixed');
    assert.equal(lines[0]?.discount_value, '25.5');
    assert.equal(lines[0]?.line_discount_minor, 2550);
    assert.equal(lines[0]?.net_minor, 7450);
    assert.equal(lines[1]?.net_minor, 1000);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Line discounts: 25\.50 INR/);

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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 1);
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
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.subtotal_minor, 15003);
    assert.equal(invoice?.line_discount_total_minor, 0);
    assert.equal(invoice?.invoice_discount_mode, 'percent');
    assert.equal(invoice?.invoice_discount_value, '33.3333');
    assert.equal(invoice?.invoice_discount_minor, 5001, '33.3333% of 15003 minor rounds to 5001');
    assert.equal(invoice?.net_subtotal_minor, 10002);
    assert.equal(invoice?.total_minor, 10002);

    let lines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.deepEqual(
      lines.map((line) => line.allocated_invoice_discount_minor),
      [3333, 1667, 1],
      'the leftover minor unit goes to the largest remainder (the medium line)',
    );
    assert.deepEqual(
      lines.map((line) => line.line_discount_minor),
      [0, 0, 0],
      'per-line discounts stay separate from the allocated invoice discount',
    );
    assert.deepEqual(
      lines.map((line) => line.net_minor),
      [6667, 3333, 2],
    );
    assert.equal(
      lines.reduce((sum, line) => sum + line.allocated_invoice_discount_minor, 0),
      invoice!.invoice_discount_minor,
      'allocated line discounts sum exactly to the invoice-wide discount',
    );

    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Invoice discount \(percent\): 50\.01 INR/);
    assert.match(html, /Net taxable subtotal: 100\.02 INR/);
    assert.match(html, /Total: 100\.02 INR/);
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
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.subtotal_minor, 25000);
    assert.equal(invoice?.line_discount_total_minor, 5500, '5000 line percent + 500 line fixed');
    assert.equal(invoice?.invoice_discount_mode, 'fixed');
    assert.equal(invoice?.invoice_discount_value, '12.34');
    assert.equal(invoice?.invoice_discount_minor, 1234);
    assert.equal(invoice?.net_subtotal_minor, 18266, '19500 post-line subtotal − 1234');
    assert.equal(invoice?.total_minor, 18266);

    let lines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.deepEqual(
      lines.map((line) => line.net_minor),
      [14051, 4215],
      'allocation is proportional to post-line-discount values, not gross values',
    );
    assert.deepEqual(
      lines.map((line) => line.allocated_invoice_discount_minor),
      [949, 285],
    );
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Line discounts: 55\.00 INR/);
    assert.match(html, /Invoice discount \(fixed\): 12\.34 INR/);
    assert.match(html, /Net taxable subtotal: 182\.66 INR/);

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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 1);
  });

  it('applies an explicit round-off adjustment that reconciles to the final total', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-round-off',
    );
    let client = await makeClient(organizationId);
    let fields = {
      line_description: ['Consulting'],
      line_quantity: ['1.5'],
      line_unit_price: ['100.0000'],
      invoice_discount_mode: ['fixed'],
      invoice_discount_value: ['0.05'],
    };

    let positive = await createDraft(sessionCookie, client.id, {
      ...fields,
      round_off: ['0.05'],
    });
    assert.equal(positive.status, 302);
    let id = draftIdFrom(positive);
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.net_subtotal_minor, 14995);
    assert.equal(invoice?.round_off_minor, 5);
    assert.equal(invoice?.total_minor, 15000);
    let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
    assert.match(html, /Net taxable subtotal: 149\.95 INR/);
    assert.match(html, /Round-off: 0\.05 INR/);
    assert.match(html, /Total: 150\.00 INR/);

    let negative = await createDraft(sessionCookie, client.id, {
      ...fields,
      round_off: ['-0.07'],
    });
    assert.equal(negative.status, 302);
    let negativeInvoice = await db.find(invoices, draftIdFrom(negative));
    assert.equal(negativeInvoice?.round_off_minor, -7);
    assert.equal(negativeInvoice?.total_minor, 14988);
    assert.match(
      await getHtml(
        router,
        routes.app.invoices.show.href({ invoiceId: negativeInvoice!.id }),
        sessionCookie,
      ),
      /Round-off: -0\.07 INR/,
    );

    let cases = [
      {
        roundOff: '-200',
        message: /round-off cannot make the total negative/i,
      },
      {
        roundOff: 'abc',
        message: /signed round-off amount/i,
      },
    ];
    for (let { roundOff, message } of cases) {
      let rejected = await createDraft(sessionCookie, client.id, { ...fields, round_off: [roundOff] });
      assert.equal(rejected.status, 400);
      let rejectedHtml = await rejected.text();
      assert.match(rejectedHtml, message);
      assert.match(rejectedHtml, new RegExp(`name="round_off"[^>]*value="${roundOff.replace('-', '\\-')}"`));
    }
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 2);
  });

  it('round-trips discounts and round-off through edit and preserves them on add-line and errors', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-discount-edit',
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
        invoice_discount_value: ['5.00'],
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
    assert.match(editPage, /name="invoice_discount_value"[^>]*value="5"/);
    assert.match(editPage, /name="round_off"[^>]*value="0\.05"/);

    let fields = draftFields(client.id, {
      line_description: ['Consulting', ''],
      line_quantity: ['2', ''],
      line_unit_price: ['100.0000', ''],
      line_discount_mode: ['fixed', ''],
      line_discount_value: ['7.50', ''],
      invoice_discount_mode: ['percent'],
      invoice_discount_value: ['10'],
      round_off: ['-1.25'],
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
    assert.match(addedHtml, /name="round_off"[^>]*value="-1\.25"/);
    assert.equal((await db.find(invoices, id))?.line_discount_total_minor, 2000);

    let invalid = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      {
        ...fields,
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
        line_discount_mode: ['fixed'],
        line_discount_value: ['201'],
      },
      sessionCookie,
    );
    assert.equal(invalid.status, 400);
    let invalidHtml = await invalid.text();
    assert.match(invalidHtml, /discount cannot exceed the line amount/i);
    assert.match(invalidHtml, /name="line_discount_value"[^>]*value="201"/);
    assert.match(invalidHtml, /name="round_off"[^>]*value="-1\.25"/);

    let updated = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      {
        ...fields,
        line_description: ['Consulting'],
        line_quantity: ['2'],
        line_unit_price: ['100.0000'],
      },
      sessionCookie,
    );
    assert.equal(updated.status, 302);
    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.line_discount_total_minor, 750);
    assert.equal(invoice?.invoice_discount_mode, 'percent');
    assert.equal(invoice?.invoice_discount_value, '10');
    assert.equal(invoice?.invoice_discount_minor, 1925, '10% of 19250 is 1925');
    assert.equal(invoice?.net_subtotal_minor, 17325);
    assert.equal(invoice?.round_off_minor, -125);
    assert.equal(invoice?.total_minor, 17200);
    let lines = await db.findMany(invoiceLines, { where: { invoice_id: id } });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.discount_mode, 'fixed');
    assert.equal(lines[0]?.line_discount_minor, 750);
    assert.equal(lines[0]?.net_minor, 17325);
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
        round_off: ['0.05'],
      }),
    );
    let before = await db.find(invoices, id);

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
    let after = await db.find(invoices, id);
    assert.equal(after?.line_discount_total_minor, before?.line_discount_total_minor);
    assert.equal(after?.invoice_discount_minor, before?.invoice_discount_minor);
    assert.equal(after?.round_off_minor, before?.round_off_minor);
    assert.equal(after?.updated_at, before?.updated_at);

    let csrfFields = draftFields(ownClient.id, {
      line_discount_mode: 'percent',
      line_discount_value: '10',
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '5.00',
      round_off: '0.05',
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
    assert.equal(await db.count(invoices, { where: { organization_id: first.organizationId } }), 1);
  });

  it('applies ISO 4217 minor-unit precision for INR, USD, JPY, and KWD', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-precision',
    );
    let client = await makeClient(organizationId);
    let expected = [
      { currency: 'INR', minor: 123, text: '1.23 INR' },
      { currency: 'USD', minor: 123, text: '1.23 USD' },
      { currency: 'JPY', minor: 1, text: '1 JPY' },
      { currency: 'KWD', minor: 1235, text: '1.235 KWD' },
    ];

    for (let { currency, minor, text } of expected) {
      let response = await createDraft(sessionCookie, client.id, {
        currency,
        line_quantity: ['1'],
        line_unit_price: ['1.2345'],
      });
      assert.equal(response.status, 302, `${currency} should be accepted`);
      let id = draftIdFrom(response);
      let invoice = await db.find(invoices, id);
      assert.equal(invoice?.total_minor, minor, `${currency} minor units`);
      let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
      assert.ok(html.includes(text), `${currency} should render ${text}`);
    }
  });

  it('respects 0, 2, and 3 minor-unit currencies for discounts and round-off', async () => {
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
        roundOff: '0.01',
        subtotal: 123,
        lineDiscount: 62,
        invoiceDiscountMinor: 1,
        netSubtotal: 60,
        total: 61,
        text: '0.61 INR',
      },
      {
        currency: 'USD',
        price: '1.2345',
        invoiceDiscount: '0.01',
        roundOff: '0.01',
        subtotal: 123,
        lineDiscount: 62,
        invoiceDiscountMinor: 1,
        netSubtotal: 60,
        total: 61,
        text: '0.61 USD',
      },
      {
        currency: 'JPY',
        price: '3.0000',
        invoiceDiscount: '1',
        roundOff: '1',
        subtotal: 3,
        lineDiscount: 2,
        invoiceDiscountMinor: 1,
        netSubtotal: 0,
        total: 1,
        text: '1 JPY',
      },
      {
        currency: 'KWD',
        price: '1.2345',
        invoiceDiscount: '0.001',
        roundOff: '0.001',
        subtotal: 1235,
        lineDiscount: 618,
        invoiceDiscountMinor: 1,
        netSubtotal: 616,
        total: 617,
        text: '0.617 KWD',
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
      let invoice = await db.find(invoices, id);
      assert.equal(invoice?.subtotal_minor, item.subtotal, `${item.currency} gross`);
      assert.equal(invoice?.line_discount_total_minor, item.lineDiscount, `${item.currency} line discount`);
      assert.equal(
        invoice?.invoice_discount_minor,
        item.invoiceDiscountMinor,
        `${item.currency} invoice discount`,
      );
      assert.equal(invoice?.net_subtotal_minor, item.netSubtotal, `${item.currency} net subtotal`);
      assert.equal(invoice?.total_minor, item.total, `${item.currency} total`);
      let html = await getHtml(router, routes.app.invoices.show.href({ invoiceId: id }), sessionCookie);
      assert.ok(html.includes(item.text), `${item.currency} should render ${item.text}`);
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

    let invoice = await db.find(invoices, draftIdFrom(response));
    assert.equal(invoice?.recipient_legal_name, 'Override Recipient');
    assert.equal(invoice?.recipient_billing_line1, '99 Override Street');
    assert.equal(invoice?.recipient_billing_locality, 'New City');
    assert.equal(invoice?.recipient_tax_value, '09ZZZ9999Z1Z5');

    let stored = await db.find(clients, client.id);
    assert.equal(stored?.legal_name, client.legal_name);
    assert.equal(stored?.billing_line1, '12 Original Road');
    assert.equal(stored?.billing_locality, 'Original City');
    assert.equal(stored?.tax_value, '27AAPCS2319F1Z5');
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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 0);

    let created = await createDraft(sessionCookie, client.id, {
      line_description: ['First', 'Second', 'Third', 'Fourth'],
      line_quantity: ['1', '2', '3', '4'],
      line_unit_price: ['10.0000', '20.0000', '30.0000', '40.0000'],
    });
    assert.equal(created.status, 302);
    let id = draftIdFrom(created);
    let savedLines = await db.findMany(invoiceLines, {
      where: { invoice_id: id },
      orderBy: [['position', 'asc']],
    });
    assert.equal(savedLines.length, 4);
    assert.deepEqual(
      savedLines.map((line) => line.description),
      ['First', 'Second', 'Third', 'Fourth'],
    );
    assert.equal((await db.find(invoices, id))?.total_minor, 30000);
  });

  it('adds a line while editing without mutating the Draft until saved', async () => {
    let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
      router,
      'invoice-edit-add-line',
    );
    let client = await makeClient(organizationId);
    let id = draftIdFrom(await createDraft(sessionCookie, client.id));
    let before = await db.find(invoices, id);

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
    assert.equal((await db.find(invoices, id))?.updated_at, before?.updated_at);
    assert.equal(await db.count(invoiceLines, { where: { invoice_id: id } }), 1);
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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 0);
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
    assert.match(html, /role="alert"[^>]*>Please correct the fields below\.</);
    assert.match(html, /Enter a service description/);
    assert.match(html, /<option value="percent" selected>Percentage<\/option>/);
    assert.match(html, /name="line_discount_value"[^>]*value="12\.5"/);
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 0);
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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 0);
    assert.equal(
      await db.count(invoiceLines, { where: { organization_id: organizationId } }),
      0,
    );

    let valid = await createDraft(sessionCookie, client.id);
    let id = draftIdFrom(valid);
    let before = await db.find(invoices, id);
    let edited = await submitDraft(
      routes.app.invoices.edit.index.href({ invoiceId: id }),
      routes.app.invoices.edit.action.href({ invoiceId: id }),
      draftFields(client.id, oversized),
      sessionCookie,
    );
    assert.equal(edited.status, 400);
    assert.match(await edited.text(), /too large to store exactly/i);
    let after = await db.find(invoices, id);
    assert.equal(after?.total_minor, before?.total_minor);
    assert.equal(after?.updated_at, before?.updated_at);
    assert.equal(await db.count(invoiceLines, { where: { invoice_id: id } }), 1);
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
    assert.match(await badCurrency.text(), /3-letter currency code/i);

    let custom = await createDraft(sessionCookie, client.id, {
      payment_term: 'custom',
      custom_payment_terms: 'Payable within 45 days',
      due_date: expectedDueDate(today, 45),
    });
    assert.equal(custom.status, 302);
    let invoice = await db.find(invoices, draftIdFrom(custom));
    assert.equal(invoice?.payment_term, 'custom');
    assert.equal(invoice?.custom_payment_terms, 'Payable within 45 days');
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 1);
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
    assert.equal(await db.count(invoices, { where: { organization_id: organizationId } }), 0);
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
    assert.equal(
      (await db.find(invoices, draftIdFrom(forged)))?.organization_id,
      first.organizationId,
    );

    let foreign = await submitDraft(
      newDraftPath(ownClient.id),
      routes.app.invoices.new.action.href(),
      draftFields(foreignClient.id),
      first.sessionCookie,
    );
    assert.equal(foreign.status, 404);
    assert.equal(await db.count(invoices, { where: { organization_id: first.organizationId } }), 1);
    assert.equal(await db.count(invoices, { where: { organization_id: second.organizationId } }), 0);
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
    assert.equal((await db.find(invoices, id))?.total_minor, 15000);

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

    let invoice = await db.find(invoices, id);
    assert.equal(invoice?.recipient_legal_name, 'Edited Recipient');
    assert.equal(invoice?.internal_note, 'Updated internal note');
    assert.equal(invoice?.currency, 'USD');
    assert.equal(invoice?.client_id, client.id, 'a forged client_id on edit is ignored');
    assert.equal(invoice?.total_minor, 3400, '20.00 + 14.00');
    let lines = await db.findMany(invoiceLines, { where: { invoice_id: id } });
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.description, 'rewritten line');
    assert.doesNotMatch(JSON.stringify(lines), /Consulting services/);
  });

  it('does not let another Organization view or edit a Draft', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-edit-scope-owner');
    let other = await createUserAndLoginWithOrganization(router, 'invoice-edit-scope-other');
    let client = await makeClient(first.organizationId);
    let created = await createDraft(first.sessionCookie, client.id);
    let id = draftIdFrom(created);
    let before = await db.find(invoices, id);

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

    let after = await db.find(invoices, id);
    assert.equal(after?.recipient_legal_name, before?.recipient_legal_name);
    assert.equal(after?.total_minor, before?.total_minor);
    assert.equal(after?.updated_at, before?.updated_at);
    assert.equal(await db.count(invoiceLines, { where: { invoice_id: id } }), 1);
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
    assert.equal((await db.find(clients, client.id))?.status, 'archived');

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
    assert.equal((await db.find(invoices, id))?.internal_note, 'Still editable');
  });

  it('discards only the current Organization’s Drafts with CSRF protection', async () => {
    let first = await createUserAndLoginWithOrganization(router, 'invoice-discard-first');
    let ownClient = await makeClient(first.organizationId);
    let firstDraft = draftIdFrom(await createDraft(first.sessionCookie, ownClient.id));
    let keepDraft = draftIdFrom(await createDraft(first.sessionCookie, ownClient.id));
    let second = await createUserAndLoginWithOrganization(router, 'invoice-discard-second');
    let foreignClient = await makeClient(second.organizationId);
    let foreignDraft = draftIdFrom(await createDraft(second.sessionCookie, foreignClient.id));

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
    assert.ok(await db.find(invoices, firstDraft));

    let foreignDiscard = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: firstDraft }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: foreignDraft }),
      {},
      first.sessionCookie,
    );
    assert.equal(foreignDiscard.status, 404);

    let discarded = await submitForm(
      router,
      routes.app.invoices.show.href({ invoiceId: firstDraft }),
      routes.app.invoices.lifecycle.discard.href({ invoiceId: firstDraft }),
      {},
      first.sessionCookie,
    );
    assert.equal(discarded.status, 302);
    assert.equal(discarded.headers.get('Location'), routes.app.invoices.index.href());

    assert.equal(await db.find(invoices, firstDraft), null);
    assert.equal(await db.count(invoiceLines, { where: { invoice_id: firstDraft } }), 0);
    assert.ok(await db.find(invoices, keepDraft));
    assert.ok(await db.find(invoices, foreignDraft));

    let directory = await getHtml(router, routes.app.invoices.index.href(), first.sessionCookie);
    assert.match(directory, /Invoice draft discarded/);
    assert.ok(!directory.includes(firstDraft), 'the discarded draft is no longer listed');
    assert.ok(directory.includes(keepDraft), 'the other draft is still listed');
  });
});
