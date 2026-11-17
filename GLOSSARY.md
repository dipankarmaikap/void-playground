# App Domain

The domain language for this app's identity, sign-in, Client management, and invoicing features. Single context: the whole repo.

## Language

### Identity

**User**:
A person who can authenticate, identified by their email address.
_Avoid_: account, member, customer

**Organization**:
A business workspace that owns its managed Clients and other organization-specific work. It is distinct from its Users and from a Business Client.
_Avoid_: account, tenant

**OrganizationMembership**:
The relationship connecting a User to an Organization and granting that User access to its work. The User who creates a new Organization is its initial owner.
_Avoid_: member

**Display name**:
An optional, non-unique name a User chooses to be addressed by. Blank means unset, and the app falls back to the email address.
_Avoid_: username, nickname, handle

**Email Verification**:
A User's proof of control over their email address, granted once via a token.
_Avoid_: confirmation, activation

### Session

**Session**:
A single sign-in of one browser, owned by exactly one User, identified by a session id.
_Avoid_: device, login, connection, anonymous session

**Authenticated Request**:
A request whose Session resolves to a User.
_Avoid_: logged-in request, signed-in request, session user

### Actions

**Log out**:
Ending the current Session, from its own browser.
_Avoid_: sign out, terminate, kill

**Revoke**:
Ending another Session of the same User, from the current one.
_Avoid_: delete, kill, terminate

### Clients

**Client**:
A person or business managed by an Organization, with an Individual or Business profile. A Client is not a User and cannot sign in.
_Avoid_: customer, account, contact, lead

**Individual**:
A Client that is a person, identified by a legal name and optionally a preferred name.
_Avoid_: person record, customer, sole trader

**Business**:
A Client profile for a business entity, identified by a legal name and optionally a trading name, industry, and one primary contact.
_Avoid_: company, organization, vendor

**Active**:
A Client listed in the default directory and available for current work.
_Avoid_: current, live, open

**Archived**:
A Client hidden from the default directory but preserved in full and restorable. Archiving never deletes.
_Avoid_: deleted, inactive, disabled, removed

**Tax identifier**:
The single optional country-specific tax number recorded on a Client, such as an India GSTIN or UIN. Missing means not recorded, not unregistered.
_Avoid_: tax ID, VAT number, GST number, tax registration

### Invoicing

**Invoice**:
A document that records an Organization's claim for payment from a Client for supplied services.
_Avoid_: bill, receipt

**Draft**:
An Invoice being prepared that has not been issued. It has no final invoice number.
_Avoid_: provisional invoice

**Service line**:
A separately described service on an Invoice, with a quantity and unit price.
_Avoid_: line item

**Line discount**:
A reduction applied to one Service line's gross amount before invoice-wide discounts.
_Avoid_: item discount

**Invoice discount**:
A reduction applied to the combined Service line amount after line discounts, allocated proportionally across the lines.
_Avoid_: order discount

**Round-off**:
An optional signed adjustment that brings the net Invoice total to the nearest whole currency unit. Exact halfway amounts round away from zero.
_Avoid_: rounding adjustment

**Issued**:
The lifecycle state of an Invoice that has been marked as sent. Issuing allocates the financial-year invoice number, locks every Client-facing detail, and stores the Seller snapshot and issued PDF artifact.
_Avoid_: finalized, posted, completed

**Sent**:
The derived display status of an issued Invoice that is not yet past its due date (or has nothing due for payment). It is computed from the Kolkata calendar date at read time, never stored.
_Avoid_: paid, settled

**Overdue**:
The derived display status of an issued Invoice past its due date with a positive total still outstanding. Until payments land in #38, the balance basis is the full Invoice total.
_Avoid_: late, unpaid

**Financial-year invoice number**:
The `PREFIX/FY/NNNN` identifier allocated exactly once at issue, from a per-Organization sequence that restarts each Indian financial year (April 1 to March 31). Failed issue attempts never consume a number.
_Avoid_: serial number, running number

**Seller snapshot**:
The seller particulars (legal name, business address, tax identifiers, branding, signatory) copied onto an Invoice at issue time from the Invoicing profile, defaulting the legal name to the Organization name, and never refreshed by later edits.
_Avoid_: live seller details, seller profile

**Issued PDF artifact**:
The byte-for-byte immutable PDF stored when an Invoice is issued and served unchanged for every later download. A missing artifact is an error, never a regeneration.
_Avoid_: regenerated PDF
