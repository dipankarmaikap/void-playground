import * as assert from 'remix/assert';
import { DataTableValidationError } from 'remix/data-table';
import { describe, it } from 'remix/test';

import { db, clients, creditNoteLines, creditNotes, invoiceLines, invoicePayments, invoiceRefunds, invoices, organizationGstRatePresets, organizationInvoicingProfiles, organizations, users } from '../db.ts';
import '../../../test/db-setup.ts';

async function createOrganization(name: string): Promise<string> {
  let id = crypto.randomUUID();
  let now = Date.now();
  await db.create(organizations, { id, name, created_at: now, updated_at: now });
  return id;
}

describe('users table hooks', () => {
  it('trims and lowercases the email before writing', async () => {
    let id = crypto.randomUUID();
    await db.create(users, {
      id,
      email: '  User@Example.COM ',
      email_verified: false,
      created_at: Date.now(),
    });

    let user = await db.find(users, id);
    assert.ok(user);
    assert.equal(user.email, 'user@example.com');
  });

  it('trims the display name before writing', async () => {
    let id = crypto.randomUUID();
    await db.create(users, {
      id,
      email: `display-${crypto.randomUUID()}@example.com`,
      display_name: '  Dana Whitmore ',
      email_verified: false,
      created_at: Date.now(),
    });

    let user = await db.find(users, id);
    assert.ok(user);
    assert.equal(user.display_name, 'Dana Whitmore');
  });

  it('rejects a create without a usable email', async () => {
    let id = crypto.randomUUID();
    await assert.rejects(
      () =>
        db.create(users, {
          id,
          email: '   ',
          email_verified: false,
          created_at: Date.now(),
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(users, id), null);
  });

  it('leaves the stored email untouched when an update changes other fields', async () => {
    let id = crypto.randomUUID();
    let email = `partial-${crypto.randomUUID()}@example.com`;
    await db.create(users, {
      id,
      email,
      display_name: null,
      email_verified: false,
      created_at: Date.now(),
    });

    await db.update(users, id, { display_name: 'Renamed', email_verified: true });
    let user = await db.find(users, id);
    assert.ok(user);
    assert.equal(user.email, email);
    assert.equal(user.display_name, 'Renamed');
  });
});

describe('organizations table hooks', () => {
  it('trims the name before writing', async () => {
    let id = crypto.randomUUID();
    await db.create(organizations, {
      id,
      name: '  Studio Bharat ',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    let organization = await db.find(organizations, id);
    assert.ok(organization);
    assert.equal(organization.name, 'Studio Bharat');
  });

  it('rejects a blank name through the validation hook', async () => {
    let id = crypto.randomUUID();
    await assert.rejects(
      () =>
        db.create(organizations, {
          id,
          name: '   ',
          created_at: Date.now(),
          updated_at: Date.now(),
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(organizations, id), null);
  });

  it('rejects an update that blanks the name', async () => {
    let id = crypto.randomUUID();
    await db.create(organizations, {
      id,
      name: 'Rename Target Studio',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await assert.rejects(() => db.update(organizations, id, { name: ' \t ' }), DataTableValidationError);
    let organization = await db.find(organizations, id);
    assert.ok(organization);
    assert.equal(organization.name, 'Rename Target Studio');
  });
});

describe('organization invoicing profile table hooks', () => {
  async function baseProfile(organizationId: string) {
    let now = Date.now();
    return {
      organization_id: organizationId,
      gst_registered: false,
      default_currency: 'INR',
      payment_term: 'due_on_receipt',
      invoice_prefix: 'INV',
      invoice_starting_number: 1,
      credit_note_prefix: 'CN',
      credit_note_starting_number: 1,
      created_at: now,
      updated_at: now,
    };
  }

  it('trims seller text and uppercases the PAN and GSTIN before writing', async () => {
    let organizationId = await createOrganization('Profile Trim Studio');
    await db.create(organizationInvoicingProfiles, {
      ...(await baseProfile(organizationId)),
      gst_registered: true,
      legal_name: '  Whitmore Consultancy ',
      pan: ' aapcs2319f ',
      gstin: ' 27aapcs2319f1z5 ',
      gst_state_code: ' 27 ',
      gst_state_name: ' Maharashtra ',
    });

    let profile = await db.find(organizationInvoicingProfiles, organizationId);
    assert.ok(profile);
    assert.equal(profile.legal_name, 'Whitmore Consultancy');
    assert.equal(profile.pan, 'AAPCS2319F');
    assert.equal(profile.gstin, '27AAPCS2319F1Z5');
    assert.equal(profile.gst_state_code, '27');
    assert.equal(profile.gst_state_name, 'Maharashtra');
  });

  it('rejects a blank legal name instead of storing it', async () => {
    let organizationId = await createOrganization('Profile Blank Studio');
    await assert.rejects(
      async () =>
        db.create(organizationInvoicingProfiles, {
          ...(await baseProfile(organizationId)),
          legal_name: '   ',
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(organizationInvoicingProfiles, organizationId), null);
  });

  it('rejects a blank billing email when one is supplied', async () => {
    let organizationId = await createOrganization('Profile Email Studio');
    await db.create(organizationInvoicingProfiles, await baseProfile(organizationId));

    await assert.rejects(
      () =>
        db.update(organizationInvoicingProfiles, organizationId, {
          billing_email: ' \t ',
          updated_at: Date.now(),
        }),
      DataTableValidationError,
    );
    let profile = await db.find(organizationInvoicingProfiles, organizationId);
    assert.ok(profile);
    assert.equal(profile.billing_email, null);
  });
});

describe('organization gst rate preset table hooks', () => {  it('canonicalizes a padded decimal rate before writing', async () => {
    let organizationId = await createOrganization('Preset Trim Studio');
    let id = crypto.randomUUID();
    let now = Date.now();
    await db.create(organizationGstRatePresets, {
      id,
      organization_id: organizationId,
      rate: ' 18.0 ',
      created_at: now,
      updated_at: now,
    });

    let preset = await db.find(organizationGstRatePresets, id);
    assert.ok(preset);
    assert.equal(preset.rate, '18');
  });

  it('rejects a non-numeric rate', async () => {
    let organizationId = await createOrganization('Preset Text Studio');
    let id = crypto.randomUUID();
    let now = Date.now();
    await assert.rejects(
      () =>
        db.create(organizationGstRatePresets, {
          id,
          organization_id: organizationId,
          rate: 'eighteen',
          created_at: now,
          updated_at: now,
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(organizationGstRatePresets, id), null);
  });

  it('rejects a rate outside 0 to 100', async () => {
    let organizationId = await createOrganization('Preset Range Studio');
    let id = crypto.randomUUID();
    let now = Date.now();
    await assert.rejects(
      () =>
        db.create(organizationGstRatePresets, {
          id,
          organization_id: organizationId,
          rate: '101',
          created_at: now,
          updated_at: now,
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(organizationGstRatePresets, id), null);
  });
});

describe('clients table hooks', () => {
  async function baseClient(organizationId: string) {
    let now = Date.now();
    return {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: 'business' as const,
      legal_name: 'Whitmore Consultancy',
      status: 'active' as const,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  it('trims text fields and uppercases the tax identifier before writing', async () => {
    let organizationId = await createOrganization('Client Trim Studio');
    let client = {
      ...(await baseClient(organizationId)),
      preferred_name: '  Dana ',
      email: '  dana@whitmore.example ',
      tax_country: '  India ',
      tax_type: '  gstin ',
      tax_value: ' 27aapcs2319f1z5 ',
    };
    await db.create(clients, client);

    let saved = await db.find(clients, client.id);
    assert.ok(saved);
    assert.equal(saved.preferred_name, 'Dana');
    assert.equal(saved.email, 'dana@whitmore.example');
    assert.equal(saved.tax_country, 'India');
    assert.equal(saved.tax_type, 'gstin');
    assert.equal(saved.tax_value, '27AAPCS2319F1Z5');
  });

  it('rejects a create with a blank legal name', async () => {
    let organizationId = await createOrganization('Client Blank Studio');
    let client = { ...(await baseClient(organizationId)), legal_name: '   ' };
    await assert.rejects(() => db.create(clients, client), DataTableValidationError);
    assert.equal(await db.find(clients, client.id), null);
  });

  it('rejects an update that blanks the legal name', async () => {
    let organizationId = await createOrganization('Client Rename Studio');
    let client = await baseClient(organizationId);
    await db.create(clients, client);

    await assert.rejects(
      () => db.update(clients, client.id, { legal_name: ' \t ', updated_at: Date.now() }),
      DataTableValidationError,
    );
    let saved = await db.find(clients, client.id);
    assert.ok(saved);
    assert.equal(saved.legal_name, 'Whitmore Consultancy');
  });

  it('leaves the legal name untouched when an update changes another field', async () => {
    let organizationId = await createOrganization('Client Partial Studio');
    let client = await baseClient(organizationId);
    await db.create(clients, client);

    await db.update(clients, client.id, { phone: ' +91 98200 00000 ', updated_at: Date.now() });
    let saved = await db.find(clients, client.id);
    assert.ok(saved);
    assert.equal(saved.legal_name, 'Whitmore Consultancy');
    assert.equal(saved.phone, '+91 98200 00000');
  });
});

describe('invoices table hooks', () => {
  async function seedDraftInvoice(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Draft Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'draft',
      invoice_number: null,
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      custom_payment_terms: null,
      recipient_legal_name: 'Draft Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      gst_mode: 'none',
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_mode: null,
      invoice_discount_value: null,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    return { invoiceId, clientId, now };
  }

  it('trims the recipient legal name and uppercases the currency before writing', async () => {
    let organizationId = await createOrganization('Invoice Trim Studio');
    let { invoiceId } = await seedDraftInvoice(organizationId);

    await db.update(invoices, invoiceId, {
      currency: ' inr ',
      recipient_legal_name: '  Whitmore Consultancy ',
      updated_at: Date.now(),
    });
    let invoice = await db.find(invoices, invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.currency, 'INR');
    assert.equal(invoice.recipient_legal_name, 'Whitmore Consultancy');
  });

  it('rejects a draft create that claims an invoice number', async () => {
    let organizationId = await createOrganization('Invoice Draft Number Studio');
    let clientId = crypto.randomUUID();
    let now = Date.now();
    let invoiceId = crypto.randomUUID();
    await assert.rejects(
      () =>
        db.create(invoices, {
          id: invoiceId,
          organization_id: organizationId,
          client_id: clientId,
          document_type: 'invoice',
          status: 'draft',
          invoice_number: 'INV-1',
          currency: 'INR',
          invoice_date: '2026-11-01',
          due_date: '2026-11-01',
          payment_term: 'due_on_receipt',
          recipient_legal_name: 'Numbered Draft Client',
          recipient_gstin_applicable: false,
          reverse_charge: false,
          subtotal_minor: 1000,
          line_discount_total_minor: 0,
          invoice_discount_minor: 0,
          net_subtotal_minor: 1000,
          round_off_minor: 0,
          total_minor: 1000,
          created_at: now,
          updated_at: now,
        }),
      DataTableValidationError,
    );
  });

  it('rejects an issued create without a number and issue timestamp', async () => {
    let organizationId = await createOrganization('Invoice Issued Studio');
    let clientId = crypto.randomUUID();
    let now = Date.now();
    let invoiceId = crypto.randomUUID();
    await assert.rejects(
      () =>
        db.create(invoices, {
          id: invoiceId,
          organization_id: organizationId,
          client_id: clientId,
          document_type: 'invoice',
          status: 'issued',
          invoice_number: null,
          issued_at: null,
          currency: 'INR',
          invoice_date: '2026-11-01',
          due_date: '2026-11-01',
          payment_term: 'due_on_receipt',
          recipient_legal_name: 'Issued Client',
          recipient_gstin_applicable: false,
          reverse_charge: false,
          subtotal_minor: 1000,
          line_discount_total_minor: 0,
          invoice_discount_minor: 0,
          net_subtotal_minor: 1000,
          round_off_minor: 0,
          total_minor: 1000,
          created_at: now,
          updated_at: now,
        }),
      DataTableValidationError,
    );
  });

  it('rejects an update that pairs a draft status with an invoice number', async () => {
    let organizationId = await createOrganization('Invoice Pair Studio');
    let { invoiceId } = await seedDraftInvoice(organizationId);

    await assert.rejects(
      () =>
        db.update(invoices, invoiceId, {
          status: 'draft',
          invoice_number: 'INV-1',
          updated_at: Date.now(),
        }),
      DataTableValidationError,
    );
    let invoice = await db.find(invoices, invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.status, 'draft');
    assert.equal(invoice.invoice_number, null);
  });

  it('accepts an issuance-shaped update that allocates number, timestamp, and seller together', async () => {
    let organizationId = await createOrganization('Invoice Issue Studio');
    let { invoiceId } = await seedDraftInvoice(organizationId);
    let now = Date.now();

    await db.update(invoices, invoiceId, {
      status: 'issued',
      invoice_number: 'INV/26-27/0001',
      issued_at: now,
      seller_legal_name: 'Invoice Issue Studio',
      seller_address_line1: '12 Linking Road',
      seller_country: 'India',
      updated_at: now,
    });
    let invoice = await db.find(invoices, invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.status, 'issued');
    assert.equal(invoice.invoice_number, 'INV/26-27/0001');
    assert.equal(invoice.issued_at, now);
  });

  it('rejects a negative total', async () => {
    let organizationId = await createOrganization('Invoice Negative Studio');
    let { invoiceId } = await seedDraftInvoice(organizationId);

    await assert.rejects(
      () => db.update(invoices, invoiceId, { total_minor: -1, updated_at: Date.now() }),
      DataTableValidationError,
    );
    let invoice = await db.find(invoices, invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.total_minor, 1000);
  });

  it('rejects totals that stop adding up when the parts are updated together', async () => {
    let organizationId = await createOrganization('Invoice Identity Studio');
    let { invoiceId } = await seedDraftInvoice(organizationId);

    await assert.rejects(
      () =>
        db.update(invoices, invoiceId, {
          net_subtotal_minor: 1000,
          tax_total_minor: 180,
          round_off_minor: 0,
          total_minor: 999,
          reverse_charge: false,
          updated_at: Date.now(),
        }),
      DataTableValidationError,
    );
    let invoice = await db.find(invoices, invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.total_minor, 1000);
  });
});

describe('invoice lines table hooks', () => {
  async function seedLine(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Line Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'draft',
      invoice_number: null,
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Line Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    return { invoiceId, now };
  }

  function lineValues(organizationId: string, invoiceId: string, now: number) {
    return {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoiceId,
      position: 0,
      description: 'Design review',
      quantity: '1',
      unit_price: '1000',
      amount_minor: 1000,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 1000,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
    };
  }

  it('trims the description before writing', async () => {
    let organizationId = await createOrganization('Line Trim Studio');
    let { invoiceId, now } = await seedLine(organizationId);
    let line = lineValues(organizationId, invoiceId, now);
    await db.create(invoiceLines, { ...line, description: '  Design review ' });

    let saved = await db.find(invoiceLines, line.id);
    assert.ok(saved);
    assert.equal(saved.description, 'Design review');
  });

  it('rejects a blank description', async () => {
    let organizationId = await createOrganization('Line Blank Studio');
    let { invoiceId, now } = await seedLine(organizationId);
    let line = lineValues(organizationId, invoiceId, now);
    await assert.rejects(
      () => db.create(invoiceLines, { ...line, description: '   ' }),
      DataTableValidationError,
    );
    assert.equal(await db.find(invoiceLines, line.id), null);
  });

  it('rejects a negative position or line amount', async () => {
    let organizationId = await createOrganization('Line Bounds Studio');
    let { invoiceId, now } = await seedLine(organizationId);
    let negativePosition = lineValues(organizationId, invoiceId, now);
    await assert.rejects(
      () => db.create(invoiceLines, { ...negativePosition, position: -1 }),
      DataTableValidationError,
    );
    let negativeAmount = lineValues(organizationId, invoiceId, now);
    await assert.rejects(
      () => db.create(invoiceLines, { ...negativeAmount, amount_minor: -1 }),
      DataTableValidationError,
    );
  });
});

describe('invoice payments table hooks', () => {
  async function seedIssuedInvoice(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Payment Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'issued',
      invoice_number: 'INV/26-27/0001',
      issued_at: now,
      seller_legal_name: 'Payment Studio',
      seller_address_line1: '12 Linking Road',
      seller_country: 'India',
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Payment Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    return invoiceId;
  }

  function paymentValues(organizationId: string, invoiceId: string) {
    let now = Date.now();
    return {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoiceId,
      payment_date: '2026-11-05',
      amount_minor: 400,
      payment_method: 'upi',
      reference: null,
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
    };
  }

  it('trims the reference before writing', async () => {
    let organizationId = await createOrganization('Payment Trim Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let payment = paymentValues(organizationId, invoiceId);
    await db.create(invoicePayments, { ...payment, reference: '  UPI/9821 ' });

    let saved = await db.find(invoicePayments, payment.id);
    assert.ok(saved);
    assert.equal(saved.reference, 'UPI/9821');
  });

  it('rejects a non-positive amount', async () => {
    let organizationId = await createOrganization('Payment Zero Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let payment = paymentValues(organizationId, invoiceId);
    await assert.rejects(
      () => db.create(invoicePayments, { ...payment, amount_minor: 0 }),
      DataTableValidationError,
    );
    assert.equal(await db.find(invoicePayments, payment.id), null);
  });

  it('rejects a void that pairs a timestamp with a blank reason', async () => {
    let organizationId = await createOrganization('Payment Void Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let payment = paymentValues(organizationId, invoiceId);
    await db.create(invoicePayments, payment);

    await assert.rejects(
      () =>
        db.update(invoicePayments, payment.id, {
          voided_at: Date.now(),
          void_reason: '   ',
          updated_at: Date.now(),
        }),
      DataTableValidationError,
    );
    let saved = await db.find(invoicePayments, payment.id);
    assert.ok(saved);
    assert.equal(saved.voided_at, null);
    assert.equal(saved.void_reason, null);
  });
});

describe('invoice refunds table hooks', () => {
  async function seedIssuedInvoice(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Refund Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'issued',
      invoice_number: 'INV/26-27/0002',
      issued_at: now,
      seller_legal_name: 'Refund Studio',
      seller_address_line1: '12 Linking Road',
      seller_country: 'India',
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Refund Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    return invoiceId;
  }

  it('rejects a non-positive amount', async () => {
    let organizationId = await createOrganization('Refund Zero Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let now = Date.now();
    let refund = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoiceId,
      refund_date: '2026-11-05',
      amount_minor: 0,
      refund_method: 'upi',
      reference: null,
      voided_at: null,
      void_reason: null,
      created_at: now,
      updated_at: now,
    };
    await assert.rejects(() => db.create(invoiceRefunds, refund), DataTableValidationError);
    assert.equal(await db.find(invoiceRefunds, refund.id), null);
  });

  it('rejects a create that voids without a reason', async () => {
    let organizationId = await createOrganization('Refund Void Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let now = Date.now();
    let refund = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoiceId,
      refund_date: '2026-11-05',
      amount_minor: 400,
      refund_method: 'upi',
      reference: null,
      voided_at: now,
      void_reason: null,
      created_at: now,
      updated_at: now,
    };
    await assert.rejects(() => db.create(invoiceRefunds, refund), DataTableValidationError);
    assert.equal(await db.find(invoiceRefunds, refund.id), null);
  });
});

describe('credit notes table hooks', () => {
  async function seedIssuedInvoice(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Credit Note Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'issued',
      invoice_number: 'INV/26-27/0003',
      issued_at: now,
      seller_legal_name: 'Credit Note Studio',
      seller_address_line1: '12 Linking Road',
      seller_country: 'India',
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Credit Note Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    return invoiceId;
  }

  function noteValues(organizationId: string, invoiceId: string) {
    let now = Date.now();
    return {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      invoice_id: invoiceId,
      status: 'draft',
      credit_note_number: null,
      credit_date: '2026-11-05',
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
    };
  }

  it('trims the reason and credit note number before writing', async () => {
    let organizationId = await createOrganization('Note Trim Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await db.create(creditNotes, {
      ...note,
      status: 'issued',
      credit_note_number: '  CN/26-27/0001 ',
      issued_at: Date.now(),
      reason: '  Scope reduced ',
    });

    let saved = await db.find(creditNotes, note.id);
    assert.ok(saved);
    assert.equal(saved.reason, 'Scope reduced');
    assert.equal(saved.credit_note_number, 'CN/26-27/0001');
  });

  it('rejects a create without a status', async () => {
    let organizationId = await createOrganization('Note Status Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    let { status: _status, ...withoutStatus } = note;
    await assert.rejects(() => db.create(creditNotes, withoutStatus), DataTableValidationError);
    assert.equal(await db.find(creditNotes, note.id), null);
  });

  it('rejects a draft that claims a credit note number', async () => {
    let organizationId = await createOrganization('Note Draft Number Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await assert.rejects(
      () => db.create(creditNotes, { ...note, credit_note_number: 'CN/26-27/0001' }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNotes, note.id), null);
  });

  it('rejects an issued create without a number and issue timestamp', async () => {
    let organizationId = await createOrganization('Note Issued Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await assert.rejects(
      () => db.create(creditNotes, { ...note, status: 'issued' }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNotes, note.id), null);
  });

  it('rejects a blank reason', async () => {
    let organizationId = await createOrganization('Note Blank Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await assert.rejects(
      () => db.create(creditNotes, { ...note, reason: ' \t ' }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNotes, note.id), null);
  });

  it('rejects a zero total', async () => {
    let organizationId = await createOrganization('Note Zero Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await assert.rejects(
      () => db.create(creditNotes, { ...note, total_minor: 0 }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNotes, note.id), null);
  });

  it('rejects a header whose parts stop adding up', async () => {
    let organizationId = await createOrganization('Note Identity Studio');
    let invoiceId = await seedIssuedInvoice(organizationId);
    let note = noteValues(organizationId, invoiceId);
    await assert.rejects(
      () =>
        db.create(creditNotes, {
          ...note,
          subtotal_minor: 500,
          line_discount_total_minor: 0,
          invoice_discount_minor: 0,
          net_subtotal_minor: 400,
        }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNotes, note.id), null);
  });
});

describe('credit note lines table hooks', () => {
  async function seedInvoiceAndLine(organizationId: string) {
    let clientId = crypto.randomUUID();
    await db.create(clients, {
      id: clientId,
      organization_id: organizationId,
      type: 'business',
      legal_name: 'Note Line Client',
      status: 'active',
      archived_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    let invoiceId = crypto.randomUUID();
    let now = Date.now();
    await db.create(invoices, {
      id: invoiceId,
      organization_id: organizationId,
      client_id: clientId,
      document_type: 'invoice',
      status: 'issued',
      invoice_number: 'INV/26-27/0004',
      issued_at: now,
      seller_legal_name: 'Note Line Studio',
      seller_address_line1: '12 Linking Road',
      seller_country: 'India',
      currency: 'INR',
      invoice_date: '2026-11-01',
      due_date: '2026-11-01',
      payment_term: 'due_on_receipt',
      recipient_legal_name: 'Note Line Client',
      recipient_gstin_applicable: false,
      reverse_charge: false,
      subtotal_minor: 1000,
      line_discount_total_minor: 0,
      invoice_discount_minor: 0,
      net_subtotal_minor: 1000,
      round_off_minor: 0,
      total_minor: 1000,
      created_at: now,
      updated_at: now,
    });
    let lineId = crypto.randomUUID();
    await db.create(invoiceLines, {
      id: lineId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      position: 0,
      description: 'Design review',
      quantity: '1',
      unit_price: '1000',
      amount_minor: 1000,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 1000,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
    });
    let noteId = crypto.randomUUID();
    await db.create(creditNotes, {
      id: noteId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      status: 'draft',
      credit_note_number: null,
      credit_date: '2026-11-05',
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
    });
    return { invoiceId, lineId, noteId, now };
  }

  function noteLineValues(
    organizationId: string,
    invoiceId: string,
    noteId: string,
    invoiceLineId: string,
    now: number,
  ) {
    return {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      credit_note_id: noteId,
      invoice_id: invoiceId,
      invoice_line_id: invoiceLineId,
      position: 0,
      description: 'Design review',
      quantity: '1',
      unit_price: '1000',
      amount_minor: 500,
      discount_mode: null,
      discount_value: null,
      line_discount_minor: 0,
      allocated_invoice_discount_minor: 0,
      net_minor: 500,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      foreign_tax_amount_minor: 0,
      created_at: now,
      updated_at: now,
    };
  }

  it('trims the description before writing', async () => {
    let organizationId = await createOrganization('Note Line Trim Studio');
    let { invoiceId, lineId, noteId, now } = await seedInvoiceAndLine(organizationId);
    let line = noteLineValues(organizationId, invoiceId, noteId, lineId, now);
    await db.create(creditNoteLines, { ...line, description: '  Design review ' });

    let saved = await db.find(creditNoteLines, line.id);
    assert.ok(saved);
    assert.equal(saved.description, 'Design review');
  });

  it('rejects a blank description', async () => {
    let organizationId = await createOrganization('Note Line Blank Studio');
    let { invoiceId, lineId, noteId, now } = await seedInvoiceAndLine(organizationId);
    let line = noteLineValues(organizationId, invoiceId, noteId, lineId, now);
    await assert.rejects(
      () => db.create(creditNoteLines, { ...line, description: '   ' }),
      DataTableValidationError,
    );
    assert.equal(await db.find(creditNoteLines, line.id), null);
  });

  it('rejects a negative position or line amount', async () => {
    let organizationId = await createOrganization('Note Line Bounds Studio');
    let { invoiceId, lineId, noteId, now } = await seedInvoiceAndLine(organizationId);
    let negativePosition = noteLineValues(organizationId, invoiceId, noteId, lineId, now);
    await assert.rejects(
      () => db.create(creditNoteLines, { ...negativePosition, position: -1 }),
      DataTableValidationError,
    );
    let negativeNet = noteLineValues(organizationId, invoiceId, noteId, lineId, now);
    await assert.rejects(
      () => db.create(creditNoteLines, { ...negativeNet, net_minor: -1 }),
      DataTableValidationError,
    );
  });
});
