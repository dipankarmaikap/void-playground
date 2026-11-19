import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients } from '../../../data/db.ts';
import { testDb as db } from '../../../../test/db-setup.ts';
import { createAppRouter } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { createUserAndLogin, postForm, submitForm } from '../../../../test/http.ts';

const router = createAppRouter({ db });

const clientTextLimits = [
  { field: 'legal_name', limit: 120 },
  { field: 'preferred_name', limit: 120 },
  { field: 'trading_name', limit: 120 },
  { field: 'industry', limit: 120 },
  { field: 'email', limit: 254 },
  { field: 'phone', limit: 40 },
  { field: 'contact_name', limit: 120 },
  { field: 'contact_role', limit: 100 },
  { field: 'contact_email', limit: 254 },
  { field: 'contact_phone', limit: 40 },
  { field: 'tax_country', limit: 100 },
  { field: 'tax_type', limit: 40 },
  { field: 'tax_value', limit: 128 },
  { field: 'billing_line1', limit: 200 },
  { field: 'billing_locality', limit: 100 },
  { field: 'billing_region', limit: 100 },
  { field: 'billing_postal_code', limit: 32 },
  { field: 'billing_country', limit: 100 },
  { field: 'billing_currency', limit: 3 },
] as const;

function maxLengthValues() {
  let maxEmail = `${'a'.repeat(242)}@example.com`;
  return {
    type: 'business',
    legal_name: `${'L'.repeat(88)}${crypto.randomUUID().replaceAll('-', '').slice(0, 32)}`,
    preferred_name: 'P'.repeat(120),
    trading_name: 'T'.repeat(120),
    industry: 'I'.repeat(120),
    email: maxEmail,
    phone: '1'.repeat(40),
    contact_name: 'C'.repeat(120),
    contact_role: 'R'.repeat(100),
    contact_email: maxEmail,
    contact_phone: '2'.repeat(40),
    tax_country: 'X'.repeat(100),
    tax_type: 'T'.repeat(40),
    tax_value: 'V'.repeat(128),
    tax_state_code: '',
    billing_line1: 'B'.repeat(200),
    billing_locality: 'L'.repeat(100),
    billing_region: 'R'.repeat(100),
    billing_postal_code: 'P'.repeat(32),
    billing_country: 'Z'.repeat(100),
    billing_currency: 'USD',
  };
}

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

describe('Client free-text length limits', () => {
  it('accepts each free-text field at its documented maximum length', async () => {
    let sessionCookie = await createUserAndLogin(router, 'client-length');
    let values = maxLengthValues();
    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      values,
      sessionCookie,
    );

    assert.equal(response.status, 302);
    let client = await db.findOne(clients, { where: { legal_name: values.legal_name } });
    assert.ok(client, 'the Client should be created at every maximum boundary');

    for (let { field, limit } of clientTextLimits) {
      assert.equal(
        client[field]?.length,
        limit,
        `${field} should accept exactly ${limit} characters`,
      );
    }
  });

  it('rejects every over-limit field with feedback and preserves the submitted value', async () => {
    let sessionCookie = await createUserAndLogin(router, 'client-length');

    for (let { field, limit } of clientTextLimits) {
      let value = 'X'.repeat(limit + 1);
      let fields: Record<string, string> = {
        type: 'business',
        legal_name: uniqueName(`Length ${field}`),
      };
      fields[field] = value;

      let response = await postForm(
        router,
        routes.app.clients.create.href(),
        fields,
        sessionCookie,
      );
      assert.equal(response.status, 400, `${field} should reject ${limit + 1} characters`);

      let html = await response.text();
      assert.match(
        html,
        new RegExp(`name="${field}"[^>]*maxlength="${limit}"`),
        `${field} should declare its browser-side maximum`,
      );
      assert.match(
        html,
        new RegExp(`name="${field}"[^>]*aria-invalid="true"`),
        `${field} should expose invalid state`,
      );
      if (field === 'preferred_name') {
        assert.doesNotMatch(
          html,
          /<div hidden[^>]*>[\s\S]*?name="preferred_name"/,
          'a hidden Individual name error should be made visible on a Business form',
        );
      }
      assert.ok(html.includes(value), `${field} should retain the submitted value`);
      assert.match(
        html,
        field === 'billing_currency'
          ? /3-letter currency code/
          : /characters or fewer/,
      );

      let persisted = await db.findOne(clients, { where: { legal_name: fields.legal_name } });
      assert.equal(persisted, null, `${field} must not create a Client`);
    }
  });

  it('rejects over-limit name submissions before trimming whitespace', async () => {
    let sessionCookie = await createUserAndLogin(router, 'client-length');
    let cases = [
      {
        field: 'legal_name',
        type: 'individual',
        value: ` ${'L'.repeat(120)}`,
      },
      {
        field: 'preferred_name',
        type: 'individual',
        value: ` ${'P'.repeat(120)}`,
      },
      {
        field: 'trading_name',
        type: 'business',
        value: ` ${'T'.repeat(120)}`,
      },
    ];

    for (let { field, type, value } of cases) {
      let fields: Record<string, string> = {
        type,
        legal_name: uniqueName(`Name length ${field}`),
      };
      fields[field] = value;

      let response = await postForm(
        router,
        routes.app.clients.create.href(),
        fields,
        sessionCookie,
      );

      assert.equal(response.status, 400, `${field} must count surrounding whitespace`);
      let html = await response.text();
      assert.ok(html.includes(value), `${field} should preserve the raw submitted value`);
      assert.match(html, /120 characters or fewer/);
      assert.equal(await db.findOne(clients, { where: { legal_name: fields.legal_name } }), null);
    }
  });

  it('reveals invalid Business-only fields on an Individual form', async () => {
    let sessionCookie = await createUserAndLogin(router, 'client-length');
    let fields = {
      type: 'individual',
      legal_name: uniqueName('Individual with hidden values'),
      trading_name: 'T'.repeat(121),
      industry: 'I'.repeat(121),
      contact_name: 'C'.repeat(121),
      contact_email: `${'a'.repeat(243)}@example.com`,
    };

    let response = await postForm(
      router,
      routes.app.clients.create.href(),
      fields,
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /name="trading_name"[^>]*aria-invalid="true"/);
    assert.match(html, /name="industry"[^>]*aria-invalid="true"/);
    assert.match(html, /name="contact_name"[^>]*aria-invalid="true"/);
    assert.match(html, /name="contact_email"[^>]*aria-invalid="true"/);
    assert.doesNotMatch(html, /<div hidden[^>]*>[\s\S]*?name="trading_name"/);
    assert.doesNotMatch(html, /<fieldset hidden[^>]*>[\s\S]*?name="contact_name"/);
  });

  it('preserves stored Client data when edit fields exceed their limits', async () => {
    let sessionCookie = await createUserAndLogin(router, 'client-length');
    let values = maxLengthValues();
    let created = await postForm(
      router,
      routes.app.clients.create.href(),
      values,
      sessionCookie,
    );
    assert.equal(created.status, 302);

    let client = await db.findOne(clients, { where: { legal_name: values.legal_name } });
    assert.ok(client);

    let submitted = {
      ...values,
      industry: 'I'.repeat(121),
      contact_email: `${'a'.repeat(243)}@example.com`,
      tax_value: 'V'.repeat(129),
      billing_line1: 'B'.repeat(201),
      billing_country: ` ${'Z'.repeat(100)}`,
      billing_currency: 'usd ',
    };
    let response = await submitForm(
      router,
      routes.app.clients.edit.href({ clientId: client.id }),
      routes.app.clients.update.href({ clientId: client.id }),
      { ...submitted, _method: 'PUT' },
      sessionCookie,
    );

    assert.equal(response.status, 400);
    let html = await response.text();
    for (let field of [
      'industry',
      'contact_email',
      'tax_value',
      'billing_line1',
      'billing_country',
      'billing_currency',
    ]) {
      assert.match(html, new RegExp(`name="${field}"[^>]*aria-invalid="true"`));
      assert.match(
        html,
        field === 'billing_currency'
          ? /3-letter currency code/
          : /characters or fewer/,
      );
    }
    assert.ok(html.includes(submitted.contact_email));
    assert.ok(html.includes(submitted.tax_value));
    assert.ok(html.includes(submitted.billing_line1));
    assert.ok(html.includes(`value="${submitted.billing_country}"`));
    assert.ok(html.includes(`value="${submitted.billing_currency}"`));

    let stored = await db.find(clients, client.id);
    assert.equal(stored?.industry, values.industry);
    assert.equal(stored?.contact_email, values.contact_email);
    assert.equal(stored?.tax_value, values.tax_value);
    assert.equal(stored?.billing_line1, values.billing_line1);
    assert.equal(stored?.billing_country, values.billing_country);
    assert.equal(stored?.billing_currency, values.billing_currency);
  });
});
