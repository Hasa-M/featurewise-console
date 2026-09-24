# ADR-0034: Use an isolated inspectable development harness

Date: 2026-09-24

Status: accepted

## Context

The retained Console and report schema require repeatable database, API and browser checks without using ordinary data or cloud services.

## Decision

Use the dedicated `featurewise-console-harness` Docker Compose project and
PostgreSQL volume. Fixed loopback ports identify its database and app services.
Store credentials, fixtures, logs, inventories and evidence in ignored
`.harness/console/`. Preserve the earlier `.harness/` artifacts and volume.

The test composition root uses real NestJS modules and substitutes storage with
an object that cannot call S3. There is no live mode, provider configuration,
capture, conversion, selection or cleanup command. Keep seed/reset, health,
read-only database inspection, Swagger and Prisma Studio.

Test ordinary initialization separately from richer harness fixtures. Test
migrations from empty and prior schemas, report relations, immutable assertions,
append-only decisions, authentication with multiple projects, and isolation.
Old-schema fixtures use separately named databases inside the dedicated container.

Use Chrome DevTools MCP for agent browser checks when available. Report its
absence honestly; automated Playwright checks are separate evidence and use the
existing local tooling. No check may call AWS or use the normal development DB.

## Consequences

Reset affects only the fixed harness volume. Generated artifacts remain local. Unit tests and SDK substitutes do not claim live S3 transport was verified.
