# App Domain

The domain language for this app's identity, sign-in, and client-management features. Single context: the whole repo.

## Language

### Identity

**User**:
A person who can authenticate, identified by their email address.
_Avoid_: account, member, customer

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
A person or business managed in the shared client book, with an Individual or Business profile. A Client is not a User and cannot sign in.
_Avoid_: customer, account, contact, lead

**Individual**:
A Client that is a person, identified by a legal name and optionally a preferred name.
_Avoid_: person record, customer, sole trader

**Business**:
A Client that is an organization, identified by a legal name and optionally a trading name, industry, and one primary contact.
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
