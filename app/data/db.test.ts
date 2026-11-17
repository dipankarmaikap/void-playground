import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { createSqliteDatabase } from 'remix/data-table/sqlite';

import {
  clients,
  db,
  invoiceLines,
  invoices,
  organizationGstRatePresets,
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
  users,
  userPasswords,
  assertClientSchemaCompatible,
  assertOrganizationSchemaCompatible,
} from './db.ts';

async function createUser(): Promise<string> {
  let id = crypto.randomUUID();
  await db.create(users, {
    id,
    email: `user-${crypto.randomUUID()}@example.com`,
    email_verified: true,
    created_at: Date.now(),
  });
  return id;
}

async function createOrganization(name: string): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(organizations, {
    id,
    name,
    created_at: now,
    updated_at: now,
  });
  return id;
}

describe('db', () => {
  it('creates and reads a user without password hash', async () => {
    let id = crypto.randomUUID();
    let email = `user-${crypto.randomUUID()}@example.com`;
    await db.create(users, { id, email, email_verified: false, created_at: Date.now() });
    await db.create(userPasswords, { user_id: id, password_hash: 'hash', updated_at: Date.now() });
    let user = await db.find(users, id);
    assert.ok(user);
    assert.equal(user.email, email);
    assert.equal('password_hash' in user, false);
  });

  it('allows different Organizations to use the same name', async () => {
    let first = await createOrganization('Same Name Studio');
    let second = await createOrganization('Same Name Studio');

    assert.notEqual(first, second);
    assert.equal((await db.find(organizations, first))?.name, 'Same Name Studio');
    assert.equal((await db.find(organizations, second))?.name, 'Same Name Studio');
  });

  it('rejects a blank Organization name', async () => {
    let invalidOrganizationId = crypto.randomUUID();
    let blankNameRejected = false;
    try {
      await db.create(organizations, {
        id: invalidOrganizationId,
        name: '   ',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      blankNameRejected = true;
    }
    assert.equal(blankNameRejected, true);
    assert.equal(await db.find(organizations, invalidOrganizationId), null);
  });

  it('rejects a whitespace-only Organization name', async () => {
    let whitespaceOrganizationId = crypto.randomUUID();
    let whitespaceNameRejected = false;
    try {
      await db.create(organizations, {
        id: whitespaceOrganizationId,
        name: ' \t\r\n ',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      whitespaceNameRejected = true;
    }
    assert.equal(whitespaceNameRejected, true);
    assert.equal(await db.find(organizations, whitespaceOrganizationId), null);
  });

  it('rejects duplicate OrganizationMemberships for the same User and Organization', async () => {
    let userId = await createUser();
    let organizationId = await createOrganization('Membership Test Studio');
    let membership = {
      organization_id: organizationId,
      user_id: userId,
      is_owner: false,
      created_at: Date.now(),
    };
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      ...membership,
    });

    let duplicateMembershipRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        ...membership,
      });
    } catch {
      duplicateMembershipRejected = true;
    }
    assert.equal(duplicateMembershipRejected, true);
  });

  it('rejects a second owner membership for an Organization', async () => {
    let userId = await createUser();
    let otherUserId = await createUser();
    let organizationId = await createOrganization('Single Owner Studio');
    await db.create(organizationMemberships, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      is_owner: true,
      created_at: Date.now(),
    });

    let secondOwnerRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        user_id: otherUserId,
        is_owner: true,
        created_at: Date.now(),
      });
    } catch {
      secondOwnerRejected = true;
    }
    assert.equal(secondOwnerRejected, true);
  });

  it('rejects an OrganizationMembership for a missing Organization', async () => {
    let userId = await createUser();
    let invalidOrganizationMembershipRejected = false;
    try {
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        organization_id: crypto.randomUUID(),
        user_id: userId,
        is_owner: false,
        created_at: Date.now(),
      });
    } catch {
      invalidOrganizationMembershipRejected = true;
    }
    assert.equal(invalidOrganizationMembershipRejected, true);
  });

  it('requires a valid Organization for every Client in SQLite', async () => {
    let organizationId = await createOrganization('Client Ownership Test');
    let now = Date.now();
    let missingOrganizationId = crypto.randomUUID();
    let missingOrganizationRejected = false;
    try {
      await db.create(clients, {
        id: missingOrganizationId,
        type: 'individual',
        legal_name: 'Missing Organization Client',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    } catch {
      missingOrganizationRejected = true;
    }
    assert.equal(missingOrganizationRejected, true);
    assert.equal(await db.find(clients, missingOrganizationId), null);

    let invalidOrganizationId = crypto.randomUUID();
    let invalidOrganizationRejected = false;
    try {
      await db.create(clients, {
        id: invalidOrganizationId,
        organization_id: crypto.randomUUID(),
        type: 'individual',
        legal_name: 'Invalid Organization Client',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    } catch {
      invalidOrganizationRejected = true;
    }
    assert.equal(invalidOrganizationRejected, true);
    assert.equal(await db.find(clients, invalidOrganizationId), null);

    let validClientId = crypto.randomUUID();
    await db.create(clients, {
      id: validClientId,
      organization_id: organizationId,
      type: 'individual',
      legal_name: 'Owned Client',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    assert.equal((await db.find(clients, validClientId))?.organization_id, organizationId);
  });

  it('requires a valid Organization and one invoicing profile per Organization', async () => {
    let organizationId = await createOrganization('Invoicing Profile Ownership Test');
    let now = Date.now();
    let orphanId = crypto.randomUUID();
    let orphanRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, {
        organization_id: orphanId,
        created_at: now,
        updated_at: now,
      });
    } catch {
      orphanRejected = true;
    }
    assert.equal(orphanRejected, true, 'a profile must belong to an existing Organization');
    assert.equal(await db.find(organizationInvoicingProfiles, orphanId), null);

    let values = { organization_id: organizationId, created_at: now, updated_at: now };
    await db.create(organizationInvoicingProfiles, values);
    let duplicateRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, values);
    } catch {
      duplicateRejected = true;
    }
    assert.equal(duplicateRejected, true, 'an Organization can have only one invoicing profile');
    assert.equal(
      await db.count(organizationInvoicingProfiles, { where: { organization_id: organizationId } }),
      1,
    );
    assert.equal((await db.find(organizationInvoicingProfiles, organizationId))?.legal_name, null);
  });

  it('rejects a partial business address at the database seam', async () => {
    let organizationId = await createOrganization('Partial Address Database Test');
    let partialAddressRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, {
        organization_id: organizationId,
        address_locality: 'Bengaluru',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      partialAddressRejected = true;
    }
    assert.equal(partialAddressRejected, true);
    assert.equal(await db.find(organizationInvoicingProfiles, organizationId), null);

    let blankLine1Rejected = false;
    try {
      await db.create(organizationInvoicingProfiles, {
        organization_id: organizationId,
        address_line1: '   ',
        address_country: 'IN',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    } catch {
      blankLine1Rejected = true;
    }
    assert.equal(blankLine1Rejected, true);
    assert.equal(await db.find(organizationInvoicingProfiles, organizationId), null);

    await db.create(organizationInvoicingProfiles, {
      organization_id: organizationId,
      address_line1: '1 Complete Street',
      address_country: 'IN',
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    assert.equal(
      (await db.find(organizationInvoicingProfiles, organizationId))?.address_country,
      'IN',
    );
  });

  it('enforces tax registration constraints on the Organization invoicing profile', async () => {
    let organizationId = await createOrganization('Tax Profile Constraint Test');
    let now = Date.now();
    let base = { organization_id: organizationId, created_at: now, updated_at: now };

    let badPanRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, { ...base, pan: 'AAPCS2319' });
    } catch {
      badPanRejected = true;
    }
    assert.equal(badPanRejected, true, 'PAN must be 10 characters');

    let enabledWithoutGstinRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, {
        ...base,
        pan: 'AAPCS2319F',
        gst_registered: true,
        gst_state_code: '27',
      });
    } catch {
      enabledWithoutGstinRejected = true;
    }
    assert.equal(enabledWithoutGstinRejected, true, 'enabled GST requires a GSTIN');

    let disabledWithGstinRejected = false;
    try {
      await db.create(organizationInvoicingProfiles, {
        ...base,
        gst_registered: false,
        gstin: '27AAPCS2319F1Z5',
        gst_state_code: '27',
      });
    } catch {
      disabledWithGstinRejected = true;
    }
    assert.equal(disabledWithGstinRejected, true, 'disabling GST must clear its identifiers');

    await db.create(organizationInvoicingProfiles, {
      ...base,
      pan: 'AAPCS2319F',
      gst_registered: true,
      gstin: '27AAPCS2319F1Z5',
      gst_state_code: '27',
      gst_state_name: 'Maharashtra',
    });
    let row = await db.find(organizationInvoicingProfiles, organizationId);
    assert.ok(row);
    assert.equal(row.pan, 'AAPCS2319F');
    assert.equal(row.gst_registered, true);
    assert.equal(row.gstin, '27AAPCS2319F1Z5');
  });

  it('defaults invoice preferences per Organization and rejects invalid values at the seam', async () => {
    let organizationId = await createOrganization('Invoice Defaults Constraint Test');
    let now = Date.now();
    await db.create(organizationInvoicingProfiles, {
      organization_id: organizationId,
      created_at: now,
      updated_at: now,
    });
    let row = await db.find(organizationInvoicingProfiles, organizationId);
    assert.ok(row);
    assert.equal(row.default_currency, 'INR');
    assert.equal(row.payment_term, 'due_on_receipt');
    assert.equal(row.invoice_prefix, 'INV');
    assert.equal(row.invoice_starting_number, 1);
    assert.equal(row.credit_note_prefix, 'CN');
    assert.equal(row.credit_note_starting_number, 1);
    assert.equal(row.logo_data_url, null);
    assert.equal(row.signature_data_url, null);

    let invalid = [
      { default_currency: 'IN' },
      { payment_term: 'net_45' },
      { payment_instructions: 'I'.repeat(1001) },
      { customer_notes: 'N'.repeat(1001) },
      { invoice_prefix: '' },
      { invoice_prefix: 'IN/V' },
      { invoice_prefix: 'TOOLONGPREFIX1' },
      { credit_note_prefix: 'CN/1' },
      { invoice_starting_number: 0 },
      { credit_note_starting_number: -3 },
      { invoice_prefix: 'SAME', credit_note_prefix: 'SAME' },
    ];
    for (let values of invalid) {
      let rejected = false;
      try {
        await db.create(organizationInvoicingProfiles, {
          organization_id: await createOrganization('Rejected Invoice Defaults Test'),
          ...values,
          created_at: now,
          updated_at: now,
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${JSON.stringify(values)}`);
    }
  });

  it('enforces branding image and signatory constraints per Organization', async () => {
    let organizationId = await createOrganization('Branding Constraint Test');
    let otherOrganizationId = await createOrganization('Other Branding Constraint Test');
    let now = Date.now();
    let validLogo = `data:image/png;base64,${Buffer.from('a small png').toString('base64')}`;

    let invalid = [
      { logo_data_url: 'data:image/gif;base64,AAAA' },
      { signature_data_url: 'data:text/html;base64,AAAA' },
      { logo_data_url: `data:image/png;base64,${'A'.repeat(175000)}` },
      { signatory_name: 'N'.repeat(121) },
      { signatory_designation: 'D'.repeat(101) },
    ];
    for (let values of invalid) {
      let rejected = false;
      try {
        await db.create(organizationInvoicingProfiles, {
          organization_id: await createOrganization('Rejected Branding Test'),
          ...values,
          created_at: now,
          updated_at: now,
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${Object.keys(values)[0]}`);
    }

    await db.create(organizationInvoicingProfiles, {
      organization_id: organizationId,
      logo_data_url: validLogo,
      signatory_name: 'Jane Doe',
      signatory_designation: 'Director',
      invoice_prefix: 'ACME',
      created_at: now,
      updated_at: now,
    });
    await db.create(organizationInvoicingProfiles, {
      organization_id: otherOrganizationId,
      credit_note_prefix: 'REFUND',
      created_at: now,
      updated_at: now,
    });

    let first = await db.find(organizationInvoicingProfiles, organizationId);
    let second = await db.find(organizationInvoicingProfiles, otherOrganizationId);
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.logo_data_url, validLogo);
    assert.equal(first.invoice_prefix, 'ACME');
    assert.equal(first.signatory_name, 'Jane Doe');
    assert.equal(second.logo_data_url, null);
    assert.equal(second.invoice_prefix, 'INV', 'the other Organization keeps its own defaults');
    assert.equal(second.credit_note_prefix, 'REFUND');
  });

  it('enforces Organization ownership and valid rates on GST presets', async () => {
    let organizationId = await createOrganization('Preset Constraint Test');
    let otherOrganizationId = await createOrganization('Other Preset Constraint Test');
    let now = Date.now();

    let orphanRejected = false;
    try {
      await db.create(organizationGstRatePresets, {
        id: crypto.randomUUID(),
        organization_id: crypto.randomUUID(),
        rate: '5',
        created_at: now,
        updated_at: now,
      });
    } catch {
      orphanRejected = true;
    }
    assert.equal(orphanRejected, true, 'a preset must belong to an existing Organization');

    for (let rate of ['-1', '101', 'abc', '1.2.3']) {
      let invalidRejected = false;
      try {
        await db.create(organizationGstRatePresets, {
          id: crypto.randomUUID(),
          organization_id: organizationId,
          rate,
          created_at: now,
          updated_at: now,
        });
      } catch {
        invalidRejected = true;
      }
      assert.equal(invalidRejected, true, `${rate} should be rejected by the database`);
    }

    await db.create(organizationGstRatePresets, {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      rate: '12.5',
      created_at: now,
      updated_at: now,
    });
    let duplicateRejected = false;
    try {
      await db.create(organizationGstRatePresets, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        rate: '12.5',
        created_at: now,
        updated_at: now,
      });
    } catch {
      duplicateRejected = true;
    }
    assert.equal(duplicateRejected, true, 'rates are unique within an Organization');

    await db.create(organizationGstRatePresets, {
      id: crypto.randomUUID(),
      organization_id: otherOrganizationId,
      rate: '12.5',
      created_at: now,
      updated_at: now,
    });
    assert.equal(
      await db.count(organizationGstRatePresets, {
        where: { organization_id: otherOrganizationId, rate: '12.5' },
      }),
      1,
      'another Organization may use the same rate',
    );
  });

  async function createClientIn(organizationId: string): Promise<string> {
    let id = crypto.randomUUID();
    let now = Date.now();
    await db.create(clients, {
      id,
      organization_id: organizationId,
      type: 'individual',
      legal_name: `Constraint Client ${id}`,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  function validInvoice(overrides: Record<string, unknown> = {}) {
    let now = Date.now();
    return {
      id: crypto.randomUUID(),
      currency: 'INR',
      invoice_date: '2026-11-17',
      due_date: '2026-11-17',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Constraint Recipient',
      subtotal_minor: 0,
      total_minor: 0,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  async function expectRejected(values: Record<string, unknown>): Promise<void> {
    let rejected = false;
    try {
      await db.create(invoices, validInvoice(values));
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, `the database must reject ${JSON.stringify(values)}`);
  }

  it('requires invoices to belong to an Organization and a Client in the same Organization', async () => {
    let organizationId = await createOrganization('Invoice Ownership Test');
    let otherOrganizationId = await createOrganization('Other Invoice Ownership Test');
    let clientId = await createClientIn(organizationId);
    let otherClientId = await createClientIn(otherOrganizationId);

    await expectRejected({ client_id: clientId });
    await expectRejected({ organization_id: crypto.randomUUID(), client_id: clientId });
    await expectRejected({ organization_id: otherOrganizationId, client_id: clientId });
    await expectRejected({ organization_id: organizationId, client_id: otherClientId });
    await expectRejected({ organization_id: organizationId, client_id: crypto.randomUUID() });

    let created = validInvoice({ organization_id: organizationId, client_id: clientId });
    await db.create(invoices, created);
    let row = await db.find(invoices, created.id);
    assert.ok(row);
    assert.equal(row.organization_id, organizationId);
    assert.equal(row.client_id, clientId);
    assert.equal(row.document_type, 'invoice');
    assert.equal(row.status, 'draft');
    assert.equal(row.invoice_number, null, 'a Draft must not allocate a final invoice number');

    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      invoice_number: 'INV/26-27/0001',
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      currency: 'IN',
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      payment_term: 'net_45',
    });
  });

  it('requires invoice lines to reference an invoice in the same Organization', async () => {
    let organizationId = await createOrganization('Invoice Line Ownership Test');
    let otherOrganizationId = await createOrganization('Other Invoice Line Ownership Test');
    let clientId = await createClientIn(organizationId);
    let otherClientId = await createClientIn(otherOrganizationId);
    let invoice = validInvoice({ organization_id: organizationId, client_id: clientId });
    let otherInvoice = validInvoice({
      organization_id: otherOrganizationId,
      client_id: otherClientId,
    });
    await db.create(invoices, invoice);
    await db.create(invoices, otherInvoice);

    let now = Date.now();
    let line = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      position: 0,
      description: 'Consulting',
      quantity: '1.5000',
      unit_price: '100.0000',
      amount_minor: 15000,
      created_at: now,
      updated_at: now,
      ...overrides,
    });

    let rejected = async (values: Record<string, unknown>) => {
      let didReject = false;
      try {
        await db.create(invoiceLines, line(values));
      } catch {
        didReject = true;
      }
      assert.equal(didReject, true, `the database must reject ${JSON.stringify(values)}`);
    };

    await rejected({ invoice_id: invoice.id });
    await rejected({ organization_id: crypto.randomUUID(), invoice_id: invoice.id });
    await rejected({ organization_id: otherOrganizationId, invoice_id: invoice.id });
    await rejected({ organization_id: organizationId, invoice_id: otherInvoice.id });
    await rejected({ organization_id: organizationId, invoice_id: crypto.randomUUID() });
    await rejected({ organization_id: organizationId, invoice_id: invoice.id, quantity: '' });
    await rejected({ organization_id: organizationId, invoice_id: invoice.id, description: '  ' });

    let validLine = line({ organization_id: organizationId, invoice_id: invoice.id });
    await db.create(invoiceLines, validLine);
    assert.equal((await db.find(invoiceLines, validLine.id))?.organization_id, organizationId);
    assert.equal(await db.count(invoiceLines, { where: { invoice_id: invoice.id } }), 1);

    await db.delete(invoices, invoice.id);
    assert.equal(await db.find(invoiceLines, validLine.id), null, 'lines cascade with their invoice');
    assert.ok(await db.find(invoices, otherInvoice.id), 'the other Organization is untouched');
  });

  it('rejects an incompatible old Client schema without serving or erasing it', async () => {
    let legacyDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await legacyDb.executeScript(`
      CREATE TABLE clients (
        id TEXT PRIMARY KEY NOT NULL,
        legal_name TEXT NOT NULL
      );
    `);

    let rejectedEmptySchema = false;
    try {
      await assertClientSchemaCompatible(legacyDb);
    } catch (error) {
      rejectedEmptySchema =
        error instanceof Error && /operator-managed clean start/.test(error.message);
    }
    assert.equal(rejectedEmptySchema, true, 'even an empty legacy table is incompatible');

    await legacyDb.executeScript(`
      INSERT INTO clients (id, legal_name) VALUES ('legacy-client', 'Preserved Legacy Client');
    `);
    let rejectedExistingData = false;
    try {
      await assertClientSchemaCompatible(legacyDb);
    } catch (error) {
      rejectedExistingData =
        error instanceof Error && /operator-managed clean start/.test(error.message);
    }
    assert.equal(rejectedExistingData, true);
    let rejectedIncompatibleSchema = false;
    try {
      await assertOrganizationSchemaCompatible(legacyDb);
    } catch (error) {
      rejectedIncompatibleSchema =
        error instanceof Error && /operator-managed clean start/.test(error.message);
    }
    assert.equal(rejectedIncompatibleSchema, true);

    let result = await legacyDb.exec('SELECT legal_name FROM clients');
    assert.equal(result.rows?.[0]?.legal_name, 'Preserved Legacy Client');
    await legacyDb.close();
  });

  it('rejects incompatible existing identity data without deleting it', async () => {
    let id = await createUser();
    let rejected = false;
    let message = '';

    try {
      await assertOrganizationSchemaCompatible();
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }

    assert.equal(rejected, true);
    assert.match(message, /operator-managed clean start/);
    assert.ok(await db.find(users, id));

    for (let user of await db.findMany(users)) {
      let membership = await db.findOne(organizationMemberships, {
        where: { user_id: user.id },
      });
      if (membership) continue;

      let organizationId = await createOrganization(`Compatibility ${crypto.randomUUID()}`);
      await db.create(organizationMemberships, {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        user_id: user.id,
        is_owner: true,
        created_at: Date.now(),
      });
    }
    await assertOrganizationSchemaCompatible();
  });
});
