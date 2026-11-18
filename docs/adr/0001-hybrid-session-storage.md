# Session storage is hybrid: cookies before login, SQLite after

## Status

accepted

A pre-login browser gets a signed cookie holding little more than a CSRF token; once a User logs in, the Session lives in the `sessions` table and the cookie carries only `db:<session id>`. A database-only design would write a row on every anonymous page view, and a cookie-only design would put Session data in the client, where it cannot be revoked server-side. The price is two storage backends in one module and a `db:` prefix that is now part of the cookie format.

## Consequences

`app/data/session/storage.ts` implements both paths behind one `SessionStorage`. Revoking a Session deletes its row, so that browser's next request degrades to a pre-login cookie rather than failing.
