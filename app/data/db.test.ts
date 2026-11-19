import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';
import { createSqliteDatabase } from 'remix/data-table/sqlite';

import {
  clients,
  creditNoteLines,
  creditNotePdfArtifacts,
  creditNotes,
  db,
  documentSequences,
  invoiceLines,
  invoicePayments,
  invoiceRefunds,
  invoicePdfArtifacts,
  invoices,
  organizationGstRatePresets,
  organizationInvoicingProfiles,
  organizationMemberships,
  organizations,
  users,
  userPasswords,
} from './db.ts';
import * as compatibility from './db/compatibility.ts';
import { migrateDatabase } from './db/migrate.ts';
import '../../test/db-setup.ts';

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
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      gst_mode: 'overseas',
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      tax_total_minor: -1,
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      recipient_gstin_applicable: 2,
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      recipient_gstin_applicable: true,
      gst_mode: 'none',
    });
    let foreignManual = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      gst_mode: 'foreign_manual',
    });
    await db.create(invoices, foreignManual);
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      gst_mode: 'india_gst',
      supply_type: 'export_igst',
      place_of_supply_country: 'IN',
    });
    await expectRejected({
      organization_id: organizationId,
      client_id: clientId,
      gst_mode: 'india_gst',
      supply_type: 'domestic',
    });
    let reverseCharge = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      gst_mode: 'india_gst',
      supply_type: 'domestic',
      place_of_supply_state_code: '27',
      reverse_charge: true,
      subtotal_minor: 1000,
      net_subtotal_minor: 1000,
      tax_total_minor: 180,
      total_minor: 1000,
    });
    await db.create(invoices, reverseCharge);
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

  it('requires invoice payments to reference an invoice in the same Organization', async () => {
    let organizationId = await createOrganization('Invoice Payment Ownership Test');
    let otherOrganizationId = await createOrganization('Other Invoice Payment Ownership Test');
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
    let payment = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      payment_date: '2026-11-17',
      amount_minor: 500,
      payment_method: 'upi',
      reference: 'PAYMENT-REF',
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let rejected = async (values: Record<string, unknown>) => {
      let didReject = false;
      try {
        await db.create(invoicePayments, payment(values));
      } catch {
        didReject = true;
      }
      assert.equal(didReject, true, `the database must reject ${JSON.stringify(values)}`);
    };

    await rejected({ organization_id: crypto.randomUUID() });
    await rejected({ organization_id: otherOrganizationId, invoice_id: invoice.id });
    await rejected({ organization_id: organizationId, invoice_id: otherInvoice.id });
    await rejected({ invoice_id: crypto.randomUUID() });
    await rejected({ amount_minor: 0 });
    await rejected({ payment_method: 'cryptocurrency' });
    await rejected({ voided_at: now, void_reason: ' \t ' });
    await rejected({ void_reason: 'Reason without a void timestamp' });

    let validPayment = payment();
    await db.create(invoicePayments, validPayment);
    assert.equal((await db.find(invoicePayments, validPayment.id))?.invoice_id, invoice.id);

    await db.delete(invoices, invoice.id);
    assert.equal(
      await db.find(invoicePayments, validPayment.id),
      null,
      'payment history cascades only with its owning invoice',
    );
    assert.ok(await db.find(invoices, otherInvoice.id));
  });

  it('requires invoice refunds to reference an invoice in the same Organization', async () => {
    let organizationId = await createOrganization('Invoice Refund Ownership Test');
    let otherOrganizationId = await createOrganization('Other Invoice Refund Ownership Test');
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
    let refund = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      refund_date: '2026-11-17',
      amount_minor: 500,
      refund_method: 'upi',
      reference: 'REFUND-REF',
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let rejected = async (values: Record<string, unknown>) => {
      let didReject = false;
      try {
        await db.create(invoiceRefunds, refund(values));
      } catch {
        didReject = true;
      }
      assert.equal(didReject, true, `the database must reject ${JSON.stringify(values)}`);
    };

    await rejected({ organization_id: crypto.randomUUID() });
    await rejected({ organization_id: otherOrganizationId, invoice_id: invoice.id });
    await rejected({ organization_id: organizationId, invoice_id: otherInvoice.id });
    await rejected({ invoice_id: crypto.randomUUID() });
    await rejected({ amount_minor: 0 });
    await rejected({ refund_method: 'cryptocurrency' });
    await rejected({ refund_date: '17-11-2026' });
    await rejected({ voided_at: now, void_reason: ' \t ' });
    await rejected({ void_reason: 'Reason without a void timestamp' });

    let validRefund = refund();
    await db.create(invoiceRefunds, validRefund);
    assert.equal((await db.find(invoiceRefunds, validRefund.id))?.invoice_id, invoice.id);

    await db.delete(invoices, invoice.id);
    assert.equal(
      await db.find(invoiceRefunds, validRefund.id),
      null,
      'refund history cascades only with its owning invoice',
    );
    assert.ok(await db.find(invoices, otherInvoice.id));
  });

  it('enforces Organization and invoice composite keys for Credit Notes, lines, and PDF artifacts', async () => {
    let organizationId = await createOrganization('Credit Note Constraint Test');
    let otherOrganizationId = await createOrganization('Other Credit Note Constraint Test');
    let clientId = await createClientIn(organizationId);
    let otherClientId = await createClientIn(otherOrganizationId);
    let now = Date.now();
    let invoice = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      subtotal_minor: 1000,
      net_subtotal_minor: 1000,
      total_minor: 1000,
    });
    let otherInvoice = validInvoice({
      organization_id: otherOrganizationId,
      client_id: otherClientId,
      subtotal_minor: 1000,
      net_subtotal_minor: 1000,
      total_minor: 1000,
    });
    await db.create(invoices, invoice);
    await db.create(invoices, otherInvoice);

    let sourceLine = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      position: 0,
      description: 'Creditable service',
      sac: '998314',
      quantity: '1.0000',
      unit_price: '10.0000',
      amount_minor: 1000,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 1000,
      tax_treatment: null,
      gst_rate: null,
      cgst_rate: null,
      sgst_rate: null,
      igst_rate: null,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_label: null,
      foreign_tax_mode: null,
      foreign_tax_rate: null,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let line = sourceLine();
    let otherLine = sourceLine({
      id: crypto.randomUUID(),
      organization_id: otherOrganizationId,
      invoice_id: otherInvoice.id,
    });
    await db.create(invoiceLines, line);
    await db.create(invoiceLines, otherLine);

    let creditNote = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      status: 'draft',
      credit_note_number: null,
      credit_date: '2026-11-17',
      reason: 'Scope reduced',
      issued_at: null,
      subtotal_minor: 500,
      line_discount_total_minor: 0,
      invoice_discount_mode: null,
      invoice_discount_minor: 0,
      net_subtotal_minor: 500,
      tax_total_minor: 0,
      round_off_minor: 0,
      total_minor: 500,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let rejectCreditNote = async (values: Record<string, unknown>) => {
      let rejected = false;
      try {
        await db.create(creditNotes, creditNote(values));
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${JSON.stringify(values)}`);
    };

    await rejectCreditNote({ organization_id: crypto.randomUUID() });
    await rejectCreditNote({ organization_id: otherOrganizationId, invoice_id: invoice.id });
    await rejectCreditNote({ organization_id: organizationId, invoice_id: otherInvoice.id });
    await rejectCreditNote({ invoice_id: crypto.randomUUID() });
    await rejectCreditNote({ reason: ' \t ' });
    await rejectCreditNote({ total_minor: 0 });

    let issued = creditNote({
      status: 'issued',
      credit_note_number: 'CN/26-27/0001',
      issued_at: now,
    });
    await db.create(creditNotes, issued);
    let duplicateNumberRejected = false;
    try {
      await db.create(
        creditNotes,
        creditNote({
          status: 'issued',
          credit_note_number: 'CN/26-27/0001',
          issued_at: now,
        }),
      );
    } catch {
      duplicateNumberRejected = true;
    }
    assert.equal(duplicateNumberRejected, true, 'Credit Note numbers are unique per Organization');

    let otherOrganizationNumber = creditNote({
      id: crypto.randomUUID(),
      organization_id: otherOrganizationId,
      invoice_id: otherInvoice.id,
      status: 'issued',
      credit_note_number: 'CN/26-27/0001',
      issued_at: now,
    });
    await db.create(creditNotes, otherOrganizationNumber);

    let draft = creditNote();
    await db.create(creditNotes, draft);
    let noteLine = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      credit_note_id: draft.id,
      invoice_id: invoice.id,
      invoice_line_id: line.id,
      position: 0,
      description: 'Credited service',
      sac: '998314',
      quantity: '0.5000',
      unit_price: '10.0000',
      amount_minor: 500,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 500,
      tax_treatment: null,
      gst_rate: null,
      cgst_rate: null,
      sgst_rate: null,
      igst_rate: null,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_label: null,
      foreign_tax_mode: null,
      foreign_tax_rate: null,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let rejectCreditNoteLine = async (values: Record<string, unknown>) => {
      let rejected = false;
      try {
        await db.create(creditNoteLines, noteLine(values));
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${JSON.stringify(values)}`);
    };
    await rejectCreditNoteLine({ organization_id: otherOrganizationId });
    await rejectCreditNoteLine({ credit_note_id: crypto.randomUUID() });
    await rejectCreditNoteLine({ invoice_id: otherInvoice.id });
    await rejectCreditNoteLine({ invoice_line_id: otherLine.id });
    await rejectCreditNoteLine({ quantity: '' });
    await rejectCreditNoteLine({ line_discount_minor: 501 });

    let validNoteLine = noteLine();
    await db.create(creditNoteLines, validNoteLine);
    let duplicateSourceLineRejected = false;
    try {
      await db.create(creditNoteLines, noteLine({ id: crypto.randomUUID() }));
    } catch {
      duplicateSourceLineRejected = true;
    }
    assert.equal(duplicateSourceLineRejected, true, 'one Draft cannot repeat an original service line');

    let artifact = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      credit_note_id: issued.id,
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let validArtifact = artifact();
    await db.create(creditNotePdfArtifacts, validArtifact);
    let storedArtifact = await db.findOne(creditNotePdfArtifacts, {
      where: { organization_id: organizationId, credit_note_id: issued.id },
    });
    assert.deepEqual(
      Array.from(storedArtifact?.data as Uint8Array),
      [0x25, 0x50, 0x44, 0x46, 0x2d],
      'Credit Note PDF bytes round-trip exactly',
    );

    let crossOrganizationArtifactRejected = false;
    try {
      await db.create(
        creditNotePdfArtifacts,
        artifact({ organization_id: otherOrganizationId }),
      );
    } catch {
      crossOrganizationArtifactRejected = true;
    }
    assert.equal(crossOrganizationArtifactRejected, true);
    let crossInvoiceArtifactRejected = false;
    try {
      await db.create(creditNotePdfArtifacts, artifact({ invoice_id: otherInvoice.id }));
    } catch {
      crossInvoiceArtifactRejected = true;
    }
    assert.equal(crossInvoiceArtifactRejected, true);
    let duplicateArtifactRejected = false;
    try {
      await db.create(creditNotePdfArtifacts, artifact({ id: crypto.randomUUID() }));
    } catch {
      duplicateArtifactRejected = true;
    }
    assert.equal(duplicateArtifactRejected, true, 'one Credit Note has one immutable PDF artifact');
  });

  it('enforces discount and round-off integrity on invoices and invoice lines', async () => {
    let organizationId = await createOrganization('Invoice Discount Constraint Test');
    let clientId = await createClientIn(organizationId);

    let invoiceRejects = async (overrides: Record<string, unknown>) => {
      let rejected = false;
      try {
        await db.create(
          invoices,
          validInvoice({ organization_id: organizationId, client_id: clientId, ...overrides }),
        );
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${JSON.stringify(overrides)}`);
    };

    await invoiceRejects({ line_discount_total_minor: -1 });
    await invoiceRejects({ invoice_discount_mode: 'flat' });
    await invoiceRejects({ invoice_discount_value: 'abc' });
    await invoiceRejects({ invoice_discount_minor: -1 });
    await invoiceRejects({ net_subtotal_minor: -1 });
    await invoiceRejects({ invoice_discount_minor: 10 });
    await invoiceRejects({ subtotal_minor: 100 });
    await invoiceRejects({ total_minor: 1 });

    let invoice = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      subtotal_minor: 10000,
      line_discount_total_minor: 1000,
      invoice_discount_mode: 'fixed',
      invoice_discount_value: '5.00',
      invoice_discount_minor: 500,
      net_subtotal_minor: 8500,
      tax_total_minor: 250,
      round_off_minor: 100,
      total_minor: 8850,
    });
    await db.create(invoices, invoice);
    assert.equal((await db.find(invoices, invoice.id))?.round_off_minor, 100);
    assert.equal((await db.find(invoices, invoice.id))?.tax_total_minor, 250);

    let negativeRoundOff = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      subtotal_minor: 10000,
      net_subtotal_minor: 10000,
      round_off_minor: -50,
      total_minor: 9950,
    });
    await db.create(invoices, negativeRoundOff);
    assert.equal((await db.find(invoices, negativeRoundOff.id))?.round_off_minor, -50);
    await invoiceRejects({
      subtotal_minor: 10000,
      net_subtotal_minor: 10000,
      round_off_minor: -20000,
      total_minor: -10000,
    });

    let now = Date.now();
    let nextPosition = 0;
    let line = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoice.id,
      position: nextPosition++,
      description: 'Consulting',
      quantity: '1.0000',
      unit_price: '100.0000',
      amount_minor: 10000,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 10000,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    let lineRejects = async (overrides: Record<string, unknown>) => {
      let rejected = false;
      try {
        await db.create(invoiceLines, line(overrides));
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `the database must reject ${JSON.stringify(overrides)}`);
    };

    await lineRejects({ discount_mode: 'flat' });
    await lineRejects({ discount_value: 'abc' });
    await lineRejects({ line_discount_minor: -1 });
    await lineRejects({ allocated_invoice_discount_minor: -1 });
    await lineRejects({ net_minor: -1 });
    await lineRejects({ line_discount_minor: 10001 });
    await lineRejects({ line_discount_minor: 6000, allocated_invoice_discount_minor: 5000 });
    await lineRejects({ line_discount_minor: 100 });
    await lineRejects({ tax_treatment: 'manual_foreign' });
    await lineRejects({ cgst_amount_minor: -1 });
    await lineRejects({ igst_amount_minor: -1 });
    await lineRejects({ gst_rate: '.' });
    await lineRejects({ cgst_rate: '.' });
    await lineRejects({ sgst_rate: '.' });
    await lineRejects({ igst_rate: '.' });
    await lineRejects({ foreign_tax_rate: '.' });

    let validLine = line({
      discount_mode: 'percent',
      discount_value: '10',
      line_discount_minor: 1000,
      allocated_invoice_discount_minor: 500,
      net_minor: 8500,
      tax_treatment: 'taxable',
      gst_rate: '18',
      cgst_rate: '9',
      sgst_rate: '9',
      cgst_amount_minor: 765,
      sgst_amount_minor: 765,
    });
    await db.create(invoiceLines, validLine);
    assert.equal((await db.find(invoiceLines, validLine.id))?.line_discount_minor, 1000);
    assert.equal(
      (await db.find(invoiceLines, validLine.id))?.allocated_invoice_discount_minor,
      500,
    );
  });

  it('enforces Organization-scoped invoice numbers and financial-year sequence keys', async () => {
    let organizationId = await createOrganization('Invoice Issue Constraint Test');
    let otherOrganizationId = await createOrganization('Other Invoice Issue Constraint Test');
    let clientId = await createClientIn(organizationId);
    let otherClientId = await createClientIn(otherOrganizationId);
    let now = Date.now();
    let invoiceNumber = 'NS/26-27/0050';
    let issued = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      status: 'issued',
      invoice_number: invoiceNumber,
      issued_at: now,
      seller_legal_name: 'Constraint Seller',
      seller_address_line1: '1 Seller Road',
      seller_country: 'IN',
    });
    await db.create(invoices, issued);

    let duplicateNumberRejected = false;
    try {
      await db.create(
        invoices,
        validInvoice({
          organization_id: organizationId,
          client_id: clientId,
          status: 'issued',
          invoice_number: invoiceNumber,
          issued_at: now,
          seller_legal_name: 'Constraint Seller',
          seller_address_line1: '1 Seller Road',
          seller_country: 'IN',
        }),
      );
    } catch {
      duplicateNumberRejected = true;
    }
    assert.equal(duplicateNumberRejected, true, 'invoice numbers are unique within an Organization');

    let sameNumberForOtherOrganization = validInvoice({
      organization_id: otherOrganizationId,
      client_id: otherClientId,
      status: 'issued',
      invoice_number: invoiceNumber,
      issued_at: now,
      seller_legal_name: 'Other Seller',
      seller_address_line1: '2 Other Road',
      seller_country: 'IN',
    });
    await db.create(invoices, sameNumberForOtherOrganization);

    let sequence = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      document_type: 'invoice',
      financial_year: '26-27',
      current_number: 50,
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    await db.create(documentSequences, sequence());

    let duplicateSequenceRejected = false;
    try {
      await db.create(documentSequences, sequence());
    } catch {
      duplicateSequenceRejected = true;
    }
    assert.equal(
      duplicateSequenceRejected,
      true,
      'one Organization has only one invoice sequence per financial year',
    );

    await db.create(
      documentSequences,
      sequence({ document_type: 'credit_note' }),
    );
    await db.create(documentSequences, sequence({ financial_year: '25-26' }));
    await db.create(
      documentSequences,
      sequence({ organization_id: otherOrganizationId }),
    );

    let missingOrganizationRejected = false;
    try {
      await db.create(
        documentSequences,
        sequence({ organization_id: crypto.randomUUID() }),
      );
    } catch {
      missingOrganizationRejected = true;
    }
    assert.equal(missingOrganizationRejected, true, 'sequences require an existing Organization');
  });

  it('keeps issued PDF artifacts bound to one invoice inside the same Organization', async () => {
    let organizationId = await createOrganization('Invoice Pdf Artifact Test');
    let otherOrganizationId = await createOrganization('Other Invoice Pdf Artifact Test');
    let clientId = await createClientIn(organizationId);
    let otherClientId = await createClientIn(otherOrganizationId);
    let now = Date.now();
    let issuedInvoice = validInvoice({
      organization_id: organizationId,
      client_id: clientId,
      status: 'issued',
      invoice_number: 'AA/26-27/0001',
      issued_at: now,
      seller_legal_name: 'Constraint Seller',
      seller_address_line1: '1 Seller Road',
      seller_country: 'IN',
    });
    await db.create(invoices, issuedInvoice);
    let otherIssuedInvoice = validInvoice({
      organization_id: otherOrganizationId,
      client_id: otherClientId,
      status: 'issued',
      invoice_number: 'AA/26-27/0001',
      issued_at: now,
      seller_legal_name: 'Other Seller',
      seller_address_line1: '2 Other Road',
      seller_country: 'IN',
    });
    await db.create(invoices, otherIssuedInvoice);

    let artifact = (overrides: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: issuedInvoice.id,
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      created_at: now,
      updated_at: now,
      ...overrides,
    });
    await db.create(invoicePdfArtifacts, artifact());
    let stored = await db.findOne(invoicePdfArtifacts, {
      where: { organization_id: organizationId, invoice_id: issuedInvoice.id },
    });
    assert.ok(stored);
    assert.deepEqual(
      Array.from(stored.data as Uint8Array),
      [0x25, 0x50, 0x44, 0x46, 0x2d],
      'artifact bytes round-trip exactly',
    );

    let duplicateArtifactRejected = false;
    try {
      await db.create(invoicePdfArtifacts, artifact({ id: crypto.randomUUID() }));
    } catch {
      duplicateArtifactRejected = true;
    }
    assert.equal(duplicateArtifactRejected, true, 'one invoice has exactly one stored PDF');

    let foreignArtifactRejected = false;
    try {
      await db.create(
        invoicePdfArtifacts,
        artifact({ id: crypto.randomUUID(), organization_id: otherOrganizationId }),
      );
    } catch {
      foreignArtifactRejected = true;
    }
    assert.equal(
      foreignArtifactRejected,
      true,
      'an artifact cannot claim an invoice owned by another Organization',
    );

    let missingArtifactDataRejected = false;
    try {
      await db.create(
        invoicePdfArtifacts,
        artifact({ id: crypto.randomUUID(), data: new Uint8Array() }),
      );
    } catch {
      missingArtifactDataRejected = true;
    }
    assert.equal(missingArtifactDataRejected, true, 'an artifact must carry PDF bytes');

    await db.delete(invoices, otherIssuedInvoice.id);
    await db.delete(invoices, issuedInvoice.id);
    assert.equal(
      await db.count(invoicePdfArtifacts, {
        where: { invoice_id: issuedInvoice.id },
      }),
      0,
      'deleting an invoice cascades to its stored PDF artifact',
    );
  });

  it('backfills net amounts when upgrading an existing #42 invoice schema', async () => {
    let legacyDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    let now = Date.now();
    let organizationId = crypto.randomUUID();
    let clientId = crypto.randomUUID();
    let invoiceId = crypto.randomUUID();
    let lineId = crypto.randomUUID();

    // Replay the pre-#43 history through the migration entry, then seed that era's data shape.
    await migrateDatabase(legacyDb, { to: '0002_invoice_ownership' });
    await legacyDb.executeScript(`
      INSERT INTO organizations (id, name, created_at, updated_at)
        VALUES ('${organizationId}', 'Legacy Org', ${now}, ${now});
      INSERT INTO clients (id, organization_id, type, legal_name, status, created_at, updated_at)
        VALUES ('${clientId}', '${organizationId}', 'business', 'Legacy Client', 'active', ${now}, ${now});
      INSERT INTO invoices (
        id, organization_id, client_id, document_type, status, invoice_number, currency,
        invoice_date, due_date, payment_term, recipient_legal_name, subtotal_minor, total_minor,
        created_at, updated_at
      ) VALUES (
        '${invoiceId}', '${organizationId}', '${clientId}', 'invoice', 'draft', NULL, 'INR',
        '2026-11-17', '2026-11-17', 'due_on_receipt', 'Legacy Recipient', 17469, 17469,
        ${now}, ${now}
      );
      INSERT INTO invoice_lines (
        id, organization_id, invoice_id, position, description, sac, quantity, unit_price,
        amount_minor, created_at, updated_at
      ) VALUES (
        '${lineId}', '${organizationId}', '${invoiceId}', 0, 'Legacy line', NULL, '1.5000',
        '100.0000', 15000, ${now}, ${now}
      );
    `);
    await migrateDatabase(legacyDb, { to: '0005_invoice_extended_tax_columns' });

    let lineSchemaResult = await legacyDb.exec(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoice_lines'",
    );
    let lineSchema = (lineSchemaResult.rows?.[0] as { sql?: string } | undefined)?.sql;
    assert.ok(lineSchema, 'the invoice line schema should exist');
    let weakLineSchema = lineSchema.replace(
      /^CREATE TABLE\s+invoice_lines\b/i,
      'CREATE TABLE invoice_lines_with_weak_tax_rates',
    );
    for (let column of ['gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'foreign_tax_rate']) {
      weakLineSchema = weakLineSchema.replace(`${column} GLOB '*[0-9]*' AND `, '');
    }
    await legacyDb.executeScript(`
      ${weakLineSchema};
      INSERT INTO invoice_lines_with_weak_tax_rates SELECT * FROM invoice_lines;
      DROP TABLE invoice_lines;
      ALTER TABLE invoice_lines_with_weak_tax_rates RENAME TO invoice_lines;
      CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);
    `);
    await legacyDb.executeScript(`
      UPDATE invoice_lines
      SET gst_rate = '18', cgst_rate = '9', sgst_rate = '9', igst_rate = '0',
          foreign_tax_rate = '.'
      WHERE id = '${lineId}';
    `);
    await migrateDatabase(legacyDb, { to: '0007_invoice_issue_columns' });

    let invoice = await legacyDb.find(invoices, invoiceId);
    assert.equal(invoice?.net_subtotal_minor, 17469, 'invoice net is backfilled from subtotal');
    assert.equal(invoice?.total_minor, 17469, 'the stored total is untouched');
    assert.equal(invoice?.gst_mode, 'none', 'existing invoices upgrade into no-tax mode');
    assert.equal(invoice?.supply_type, null, 'legacy no-tax invoices have no export classification');
    assert.equal(invoice?.tax_total_minor, 0);
    assert.equal(invoice?.issued_at, null, 'legacy Drafts upgrade without an issue timestamp');
    let line = await legacyDb.find(invoiceLines, lineId);
    assert.equal(line?.net_minor, 15000, 'line net is backfilled from the gross amount');
    assert.equal(line?.amount_minor, 15000);
    assert.equal(line?.foreign_tax_amount_minor, 0, 'new manual tax amounts default to zero');

    let rejectedNegativeManualTax = false;
    try {
      await legacyDb.executeScript(
        `UPDATE invoice_lines SET foreign_tax_amount_minor = -1 WHERE id = '${lineId}';`,
      );
    } catch {
      rejectedNegativeManualTax = true;
    }
    assert.equal(rejectedNegativeManualTax, true, 'the migrated schema rejects negative tax amounts');

    let rejectedInvalidManualRate = false;
    try {
      await legacyDb.executeScript(
        `UPDATE invoice_lines SET foreign_tax_rate = '10x' WHERE id = '${lineId}';`,
      );
    } catch {
      rejectedInvalidManualRate = true;
    }
    assert.equal(rejectedInvalidManualRate, true, 'the migrated schema rejects malformed tax rates');

    let migratedLine = await legacyDb.find(invoiceLines, lineId);
    assert.equal(migratedLine?.gst_rate, '18');
    assert.equal(migratedLine?.cgst_rate, '9');
    assert.equal(migratedLine?.sgst_rate, '9');
    assert.equal(migratedLine?.igst_rate, '0');
    assert.equal(migratedLine?.foreign_tax_rate, '0', 'a lone decimal point is canonicalized to zero');
    assert.equal(migratedLine?.amount_minor, 15000, 'migration preserves existing amounts');
    assert.equal(migratedLine?.net_minor, 15000, 'migration preserves existing net values');

    for (let column of ['gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'foreign_tax_rate']) {
      let rejectedDotRate = false;
      try {
        await legacyDb.executeScript(
          `UPDATE invoice_lines SET ${column} = '.' WHERE id = '${lineId}';`,
        );
      } catch {
        rejectedDotRate = true;
      }
      assert.equal(rejectedDotRate, true, `the upgraded schema rejects a lone ${column} point`);
    }

    // A later startup must not overwrite a legitimate net value produced by #43 discounts: the
    // journal owns run-once, so re-running the entry replays nothing.
    await legacyDb.executeScript(
      `UPDATE invoices SET subtotal_minor = 999, net_subtotal_minor = 999, total_minor = 999 WHERE id = '${invoiceId}';` +
        `UPDATE invoice_lines SET net_minor = 888 WHERE id = '${lineId}';`,
    );
    await migrateDatabase(legacyDb);
    assert.equal((await legacyDb.find(invoices, invoiceId))?.net_subtotal_minor, 999);
    assert.equal((await legacyDb.find(invoiceLines, lineId))?.net_minor, 888);
    await legacyDb.close();
  });

  it('rejects a journal-less legacy schema without migrating or erasing it', async () => {
    let legacyDb = createSqliteDatabase({ filename: ':memory:', foreignKeys: true });
    await legacyDb.executeScript(`
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL, client_id TEXT NOT NULL,
        status TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
    `);

    let rejected = false;
    let message = '';
    try {
      await migrateDatabase(legacyDb);
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : '';
    }
    assert.equal(
      rejected,
      true,
      'a database from the pre-journal pipeline must fail closed before any migration SQL runs',
    );
    assert.match(message, /operator-managed clean start/);
    let tables = await legacyDb.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN " +
        "('invoices', 'data_table_migrations') ORDER BY name",
    );
    let tableNames = (tables.rows ?? []).map((row) => String((row as { name?: unknown }).name));
    assert.equal(
      tableNames.join(','),
      'invoices',
      'the legacy table survives and no journal table was created',
    );
    await legacyDb.close();
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
      await compatibility.assertClientSchemaCompatible(legacyDb);
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
      await compatibility.assertClientSchemaCompatible(legacyDb);
    } catch (error) {
      rejectedExistingData =
        error instanceof Error && /operator-managed clean start/.test(error.message);
    }
    assert.equal(rejectedExistingData, true);
    let rejectedIncompatibleSchema = false;
    try {
      await compatibility.assertOrganizationSchemaCompatible(legacyDb);
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
      await compatibility.assertOrganizationSchemaCompatible(db);
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
    await compatibility.assertOrganizationSchemaCompatible(db);
  });
});
