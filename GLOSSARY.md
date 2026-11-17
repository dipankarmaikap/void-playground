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
The derived display status of an issued Invoice with no active payments when its due date is today or later in Asia/Kolkata, or when its total is zero. It is computed from the Kolkata calendar date at read time, never stored.
_Avoid_: paid, settled

**Overdue**:
The derived display status of an issued Invoice whose due date has passed in Asia/Kolkata while a positive balance remains, including when some payments have been recorded.
_Avoid_: late, unpaid

**Partially Paid**:
The derived display status of an issued Invoice with a positive amount paid and a positive balance due through its due date in Asia/Kolkata. After that date, the status is Overdue.
_Avoid_: part-paid, partly paid

**Paid**:
The derived display status of an issued Invoice whose positive amount due has been fully paid, leaving no balance due.
_Avoid_: settled

**Payment**:
A confirmed offline receipt recorded against an issued Invoice in that Invoice's currency.
_Avoid_: transaction

**Voided payment**:
A previously recorded Payment reversed with a reason and timestamp. It remains in the Invoice's payment history but no longer counts toward the balance.
_Avoid_: deleted payment

**Net paid**:
Active payments minus active refunds on an issued Invoice. It is the amount actually still collected after returned money is accounted for.
_Avoid_: adjusted receipts

**Refund due**:
The amount by which net paid exceeds the Invoice's revised total, typically after an issued Credit Note lowers that total below payments already collected. It is shown separately from balance due and decreases as refunds are recorded.
_Avoid_: overpayment balance, customer credit

**Refund**:
A manual return of money to a Client recorded against an over-credited paid Invoice in that Invoice's currency, with a date, amount, method, and optional reference, never above the current refund due.
_Avoid_: reversing a payment, credit note

**Voided refund**:
A previously recorded Refund reversed with a reason and timestamp. It remains in the Invoice's refund history but no longer reduces the refund due.
_Avoid_: deleted refund

**Financial-year invoice number**:
The `PREFIX/FY/NNNN` identifier allocated exactly once at issue, from a per-Organization sequence that restarts each Indian financial year (April 1 to March 31). Failed issue attempts never consume a number.
_Avoid_: serial number, running number

**Seller snapshot**:
The seller particulars (legal name, business address, tax identifiers, branding, signatory) copied onto an Invoice at issue time from the Invoicing profile, defaulting the legal name to the Organization name, and never refreshed by later edits.
_Avoid_: live seller details, seller profile

**Issued PDF artifact**:
The byte-for-byte immutable PDF stored when an Invoice is issued and served unchanged for every later download. A missing artifact is an error, never a regeneration.
_Avoid_: regenerated PDF

**Credit Note**:
An Organization-scoped adjustment document linked to one issued Invoice. Its issued amount reduces the Invoice's revised total without changing the original Invoice.
_Avoid_: credit memo, refund

**Credit Note Draft**:
A linked Credit Note being prepared. It has no final number and does not change the parent Invoice balance or status.
_Avoid_: provisional credit memo

**Issued Credit Note**:
A Credit Note assigned a financial-year credit-note number and frozen with its own immutable PDF artifact.
_Avoid_: finalized credit memo

**Financial-year credit-note number**:
The Organization-scoped `PREFIX/FY/NNNN` identifier allocated when a Credit Note is issued, based on the credit-note date's Indian financial year.
_Avoid_: credit-note sequence before issue

**Revised total**:
An issued Invoice's original total minus the total of its issued Credit Notes. Draft Credit Notes do not count.
_Avoid_: adjusted total before issue

**Cancelled**:
The derived display status of an issued Invoice whose issued Credit Notes equal its original total. The original Invoice remains preserved and linked to its Credit Notes.
_Avoid_: deleted Invoice
