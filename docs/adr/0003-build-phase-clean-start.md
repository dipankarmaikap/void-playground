# Build-phase clean start: persisted databases are disposable

## Status

accepted

## Decision

The app is pre-release with no real Users, so no code may exist to support a previously persisted database. Schema changes, hash-format changes, and Session payload-shape changes are resolved by an operator deleting the database file and restarting — never by legacy-database guards, legacy-hash verification, tolerant reads of old payload shapes, or compatibility migrations. This supersedes the startup-rejection mechanism in [ADR-0002](0002-organization-access.md) (the OrganizationMembership access model itself stands). Revisit — and supersede this ADR — once the app has real Users with data worth preserving.

## Consequences

Deleting the dev database file is the documented remedy for any unrecognized, stale, or half-migrated database; the app never wipes or backfills data in code (unchanged from ADR-0002). Agents must not add legacy-database guards, legacy-hash verification, or optional-field payload reads to paper over a shape change. Existing compatibility code (the legacy-schema guard module and the tolerant Session payload read) is slated for removal under spec issue #67.
