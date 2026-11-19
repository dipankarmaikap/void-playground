import * as assert from 'remix/assert';
import { DataTableValidationError } from 'remix/data-table';
import { describe, it } from 'remix/test';

import { db, organizationGstRatePresets, organizationInvoicingProfiles, organizations, users } from '../db.ts';
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

describe('organization gst rate preset table hooks', () => {
  it('canonicalizes a padded decimal rate before writing', async () => {
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
