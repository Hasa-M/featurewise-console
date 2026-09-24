# ADR-0038: Store reports, findings, sources and human decisions

Date: 2026-09-24

Status: accepted

## Context

A review is produced outside this backend. Its assertions and evidence must remain attributable after later metadata changes or human decisions.

## Decision

A `ReviewReport` belongs to one Feature and stores report content, formatVersion,
savedBy, producedAt and savedAt. It has zero or more immutable `ReviewFinding`
records: ordered position, title, description, whyItMatters, category, severity,
suggested resolutions, and optional producer-supplied verification metadata.
Such metadata does not certify that the backend performed verification.

Each report owns its sources and attachments. `ReportAttachment` links a report
to an exact retained StorageObject original of the same feature. Composite
foreign keys enforce that boundary. `ReportSource` is one of:

- `attachment`: references an attachment of that same report;
- `local_code`: stores a relative slash-separated path and excerpt, with optional revision;
- `mcp`: stores a reference and optional revision, without copied source content;
- `reference`: stores another external reference without a copied document.

No source requires a remote repository or provider. Absolute paths, drive paths,
backslashes and traversal segments are rejected. `FindingEvidence` references
both a finding and a source in its exact report through composite foreign keys;
it may carry a locator and excerpt, except that MCP content is never copied.

Reports, findings, sources, attachments and evidence reject update/delete.
`FindingReview` is separately append-only, with decision accepted, dismissed,
resolved or deferred, author, optional reason and timestamp. The latest decision
ordered by createdAt then publicNumber determines current disposition; no review
means no human disposition. Findings in different reports never match automatically.
Database checks constrain report/decision authors to the feature organization.

These are persistence foundations, not an import protocol. No report reception,
history or decision API is implemented here. Future ingestion must validate a
complete report and persist its related rows atomically.

## Consequences

Results retain their original assertions. Human decisions do not rewrite them. SQL constraints and integration tests enforce report-local evidence and feature-local attachments independently of future transport design.
