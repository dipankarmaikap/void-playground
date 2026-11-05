# Auth & Sessions

The domain language for this app's identity and sign-in features. Single context: the whole repo.

## Language

### Identity

**User**:
A person who can authenticate, identified by their email address.
_Avoid_: account, member, customer

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
