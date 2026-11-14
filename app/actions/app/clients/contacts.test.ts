import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { clients, db } from '../../../data/db.ts';
import { router } from '../../../router.ts';
import { routes } from '../../../routes.ts';
import { createUserAndLogin, getHtml, origin, postForm } from '../../../../test/http.ts';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID()}`;
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

describe('client contacts', () => {
  it('creates, views, and edits an Individual email and phone', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Contact Individual');
    let email = uniqueEmail('person');
    let phone = '+91 98765 43210';

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, email, phone },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location, 'create should redirect to the profile');

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row, 'the Individual should be persisted');
    assert.equal(row.email, email);
    assert.equal(row.phone, phone);
    assert.equal(row.contact_name, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /<dt[^>]*>Email<\/dt>/);
    assert.match(profile, new RegExp(email));
    assert.match(profile, /<dt[^>]*>Phone<\/dt>/);
    assert.ok(profile.includes(phone), 'the phone should appear on the profile');

    let updatedEmail = uniqueEmail('person-updated');
    let updatedPhone = '(020) 7946-0000';
    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      { type: 'individual', legal_name: legalName, email: updatedEmail, phone: updatedPhone },
      sessionCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.email, updatedEmail);
    assert.equal(stored?.phone, updatedPhone);

    let updatedProfile = await getHtml(router, location, sessionCookie);
    assert.match(updatedProfile, new RegExp(updatedEmail));
    assert.ok(updatedProfile.includes(updatedPhone));
  });

  it('trims contact values and stores blank optional values as null', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Optional Contacts');
    let email = uniqueEmail('trimmed');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'individual',
        legal_name: legalName,
        email: `  ${email}  `,
        phone: '   ',
        contact_name: '   ',
        contact_role: '   ',
        contact_email: '   ',
        contact_phone: '   ',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.email, email);
    assert.equal(row.phone, null);
    assert.equal(row.contact_name, null);
    assert.equal(row.contact_role, null);
    assert.equal(row.contact_email, null);
    assert.equal(row.contact_phone, null);
  });

  it('accepts an Individual with no contact details', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('No Contacts');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.email, null);
    assert.equal(row.phone, null);

    let profile = await getHtml(router, location, sessionCookie);
    assert.doesNotMatch(profile, /<h2[^>]*>Contacts<\/h2>/);
  });

  it('rejects an invalid Individual email and keeps the submitted values', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Invalid Email');
    let badEmail = 'not-an-email';
    let phone = '+91 98765 43210';

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, email: badEmail, phone },
      sessionCookie,
    );
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter a valid email address\./);
    assert.match(html, new RegExp(`name="email"[^>]*value="${badEmail}"`));
    assert.match(html, /name="email"[^>]*aria-invalid="true"/);
    assert.ok(html.includes(phone), 'the valid phone should be preserved');
    assert.match(html, /<meta name="robots" content="noindex"/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null, 'an invalid submission should not create a client');
  });

  it('rejects an invalid Individual phone number and keeps the submitted values', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Invalid Phone');
    let email = uniqueEmail('valid');
    let badPhone = 'call me maybe';

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, email, phone: badPhone },
      sessionCookie,
    );
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter a valid international phone number/);
    assert.match(html, new RegExp(`name="phone"[^>]*value="${badPhone}"`));
    assert.match(html, /name="phone"[^>]*aria-invalid="true"/);
    assert.match(html, new RegExp(email));

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('creates, views, and edits Business shared and primary-contact details', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Contact Business');
    let sharedEmail = uniqueEmail('shared');
    let sharedPhone = '+44 20 7946 0958';
    let contactName = uniqueName('Priya Sharma');
    let contactRole = 'Accounts payable';
    let contactEmail = uniqueEmail('priya');
    let contactPhone = '(022) 2493-4404';

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'business',
        legal_name: legalName,
        email: sharedEmail,
        phone: sharedPhone,
        contact_name: contactName,
        contact_role: contactRole,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.email, sharedEmail);
    assert.equal(row.phone, sharedPhone);
    assert.equal(row.contact_name, contactName);
    assert.equal(row.contact_role, contactRole);
    assert.equal(row.contact_email, contactEmail);
    assert.equal(row.contact_phone, contactPhone);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /<dt[^>]*>Email<\/dt>/);
    assert.match(profile, new RegExp(sharedEmail));
    assert.match(profile, /<dt[^>]*>Phone<\/dt>/);
    assert.ok(profile.includes(sharedPhone));
    assert.match(profile, /<dt[^>]*>Primary contact<\/dt>/);
    assert.ok(profile.includes(contactName));
    assert.ok(profile.includes(contactRole));
    assert.match(profile, /<dt[^>]*>Contact email<\/dt>/);
    assert.match(profile, new RegExp(contactEmail));
    assert.match(profile, /<dt[^>]*>Contact phone<\/dt>/);
    assert.ok(profile.includes(contactPhone));

    let updatedRole = 'Finance director';
    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      {
        type: 'business',
        legal_name: legalName,
        email: sharedEmail,
        phone: sharedPhone,
        contact_name: contactName,
        contact_role: updatedRole,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      },
      sessionCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.contact_role, updatedRole);
    assert.equal(stored?.contact_name, contactName);

    let updatedProfile = await getHtml(router, location, sessionCookie);
    assert.match(updatedProfile, new RegExp(updatedRole));
  });

  it('requires a primary contact name when any other primary-contact field is present', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Named Contact Required');
    let role = 'Operations';
    let contactEmail = uniqueEmail('ops');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'business',
        legal_name: legalName,
        contact_name: '',
        contact_role: role,
        contact_email: contactEmail,
        contact_phone: '',
      },
      sessionCookie,
    );
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /<p role="alert"[^>]*>Please correct the fields below\.<\/p>/);
    assert.match(html, /Enter the primary contact name\./);
    assert.match(html, /name="contact_name"[^>]*aria-invalid="true"/);
    assert.match(html, new RegExp(`name="contact_role"[^>]*value="${role}"`));
    assert.match(html, new RegExp(`name="contact_email"[^>]*value="${contactEmail}"`));

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('accepts a Business primary contact with only a name', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Name Only Contact');
    let contactName = uniqueName('Sam Rivera');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'business',
        legal_name: legalName,
        contact_name: contactName,
        contact_role: '',
        contact_email: '',
        contact_phone: '',
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);

    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);
    assert.equal(row.contact_name, contactName);
    assert.equal(row.contact_role, null);
    assert.equal(row.contact_email, null);
    assert.equal(row.contact_phone, null);
  });

  it('rejects invalid primary-contact email and phone values', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Invalid Contact Details');
    let contactName = uniqueName('Jordan Lee');

    let response = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'business',
        legal_name: legalName,
        contact_name: contactName,
        contact_role: 'Buyer',
        contact_email: 'jordan-at-example',
        contact_phone: 'ring the office',
      },
      sessionCookie,
    );
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Enter a valid primary contact email address\./);
    assert.match(html, /Enter a valid primary contact phone number/);
    assert.match(html, /name="contact_email"[^>]*aria-invalid="true"/);
    assert.match(html, /name="contact_phone"[^>]*aria-invalid="true"/);
    assert.match(html, /name="contact_email"[^>]*value="jordan-at-example"/);
    assert.match(html, /name="contact_phone"[^>]*value="ring the office"/);

    let persisted = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.equal(persisted, null);
  });

  it('allows the same email, phone, and primary contact across Clients', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let sharedEmail = uniqueEmail('duplicate');
    let sharedPhone = '+91 90000 00000';
    let contactName = uniqueName('Shared Contact');
    let contactEmail = uniqueEmail('duplicate-contact');

    let firstName = uniqueName('Duplicate One');
    let secondName = uniqueName('Duplicate Two');

    for (let legalName of [firstName, secondName]) {
      let response = await postForm(
        router,
        routes.app.clients.new.action.href(),
        {
          type: 'business',
          legal_name: legalName,
          email: sharedEmail,
          phone: sharedPhone,
          contact_name: contactName,
          contact_email: contactEmail,
        },
        sessionCookie,
      );
      assert.equal(response.status, 302, `${legalName} should be created`);
    }

    let rows = await db.findMany(clients, {
      where: { email: sharedEmail },
      orderBy: [['legal_name', 'asc']],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].phone, sharedPhone);
    assert.equal(rows[1].contact_name, contactName);
    assert.equal(rows[0].contact_email, contactEmail);
  });

  it('persists contacts for a second authenticated User to view and edit', async () => {
    let firstCookie = await createUserAndLogin(router, 'contacts');
    let secondCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Shared Contacts');
    let email = uniqueEmail('owner');
    let phone = '+61 2 9374 4000';

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, email, phone },
      firstCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let secondProfile = await getHtml(router, location, secondCookie);
    assert.match(secondProfile, new RegExp(email));
    assert.ok(secondProfile.includes(phone));

    let updatedPhone = '+61 2 9999 1111';
    let edited = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      { type: 'individual', legal_name: legalName, email, phone: updatedPhone },
      secondCookie,
    );
    assert.equal(edited.status, 302);

    let stored = await db.find(clients, row.id);
    assert.equal(stored?.phone, updatedPhone);
    assert.equal(stored?.email, email);

    let anonymous = await router.fetch(new URL(location, origin));
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('Location'), routes.auth.login.index.href());
  });

  it('keeps Business primary-contact values through a type change', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Contact Type Change');
    let contactName = uniqueName('Casey Morgan');
    let contactRole = 'Procurement';
    let contactEmail = uniqueEmail('casey');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      {
        type: 'business',
        legal_name: legalName,
        contact_name: contactName,
        contact_role: contactRole,
        contact_email: contactEmail,
      },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let location = created.headers.get('Location');
    assert.ok(location);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    // The form keeps the hidden Business group in the submission, so an Individual switch
    // must not erase the primary contact.
    let toIndividual = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      {
        type: 'individual',
        legal_name: legalName,
        contact_name: contactName,
        contact_role: contactRole,
        contact_email: contactEmail,
        contact_phone: '',
      },
      sessionCookie,
    );
    assert.equal(toIndividual.status, 302);

    let individualRow = await db.find(clients, row.id);
    assert.equal(individualRow?.type, 'individual');
    assert.equal(individualRow?.contact_name, contactName);
    assert.equal(individualRow?.contact_role, contactRole);
    assert.equal(individualRow?.contact_email, contactEmail);

    let individualProfile = await getHtml(router, location, sessionCookie);
    assert.doesNotMatch(individualProfile, /<dt[^>]*>Primary contact<\/dt>/);
    assert.doesNotMatch(individualProfile, /<dt[^>]*>Contact email<\/dt>/);
    assert.doesNotMatch(individualProfile, new RegExp(contactName));
    assert.doesNotMatch(individualProfile, new RegExp(contactEmail));

    let individualEdit = await getHtml(
      router,
      routes.app.clients.edit.index.href({ clientId: row.id }),
      sessionCookie,
    );
    assert.match(individualEdit, new RegExp(`name="contact_name"[^>]*value="${contactName}"`));
    assert.match(individualEdit, /name="contact_email"/);

    let backToBusiness = await postForm(
      router,
      routes.app.clients.edit.action.href({ clientId: row.id }),
      {
        type: 'business',
        legal_name: legalName,
        contact_name: contactName,
        contact_role: contactRole,
        contact_email: contactEmail,
      },
      sessionCookie,
    );
    assert.equal(backToBusiness.status, 302);

    let profile = await getHtml(router, location, sessionCookie);
    assert.match(profile, /<dt[^>]*>Primary contact<\/dt>/);
    assert.ok(profile.includes(contactName));
  });

  it('rejects contact edits without a CSRF token', async () => {
    let sessionCookie = await createUserAndLogin(router, 'contacts');
    let legalName = uniqueName('Contact CSRF');
    let originalEmail = uniqueEmail('original');

    let created = await postForm(
      router,
      routes.app.clients.new.action.href(),
      { type: 'individual', legal_name: legalName, email: originalEmail },
      sessionCookie,
    );
    assert.equal(created.status, 302);
    let row = await db.findOne(clients, { where: { legal_name: legalName } });
    assert.ok(row);

    let response = await router.fetch(
      new URL(routes.app.clients.edit.action.href({ clientId: row.id }), origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({
          type: 'individual',
          legal_name: legalName,
          email: uniqueEmail('tampered'),
        }).toString(),
      },
    );

    assert.equal(response.status, 403);
    let stored = await db.find(clients, row.id);
    assert.equal(stored?.email, originalEmail);
  });
});
