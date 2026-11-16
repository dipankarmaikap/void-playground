# OrganizationMembership is the source of Organization access

## Status

accepted

## Decision

The server resolves Organization access from the authenticated User's OrganizationMembership, never from a Session field or request-supplied Organization ID. Missing or ambiguous membership fails closed. Client rows belong to an Organization, and server queries scope Client visibility and mutation to the resolved Organization. SQLite constraints protect data integrity; they do not provide row-level security.

Sessions remain User-scoped as described in [ADR-0001](0001-hybrid-session-storage.md). Startup rejects legacy schemas or data without Organization ownership; continuing requires an operator-managed clean start, and the app never wipes or backfills legacy data.
