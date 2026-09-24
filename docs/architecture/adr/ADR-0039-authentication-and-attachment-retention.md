# ADR-0039: Retain authentication and private original attachments

Date: 2026-09-24

Status: accepted

## Context

The Console needs a working account even before any project exists. Existing private originals must survive removal of editable context and preparation metadata.

## Decision

Keep one operator per organization, username/password login, bearer JWT session
restoration, protected routes and client logout. Use standard Argon2id. Initial
seed creates a named organization and operator from environment; it creates no
projects/reports, serializes concurrent setup by username, and never resets an
existing password, activation state or organization name. Keep the setup username
stable; changing it asks for a different initial operator. The session has no
project; authorization checks each project's organization.

Keep the compiled Storage module and private S3 originals, immutable object keys,
version IDs, checksums, MIME types and sizes. Storage metadata belongs to Feature.
Existing keys retain their original spelling even if they contain old path segments.
New keys use feature ownership and random unique segments. Writes use create-only
semantics; reads and signed access identify exact versions. Storage configuration
is optional until an actual storage operation is requested. No upload/report-link
HTTP flow is exposed in this refactor.

Linking a report attachment locks the original row and sets firstUsedAt only when
unset. Confirmed original identity/ownership and first-use metadata cannot change;
retained originals cannot be deleted. There is no active physical cleanup or
conversion capability. SQL migrations never call cloud services or delete S3 bytes.

The incremental migration preserves organizations, users, projects, features and
original references, removes old editable inputs and execution tables, and removes
derivative metadata only after the inventory exporter has written a local JSON
file, verified its SHA-256 by reading it back, and recorded a receipt. Migration
compares the current inventory with that receipt under a table lock and rejects
missing/stale exports. Fresh databases without derivatives require no receipt.
Export files retain keys, versions, checksums and ownership for recovery.

## Consequences

Login and container management work without S3. Database migration and deterministic tests make no cloud calls. Historical originals and local inventories remain recoverable while upload integration and report access await their future vertical slice.
