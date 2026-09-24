# Featurewise architecture

Featurewise keeps a working Console and NestJS backend for organizing projects
and features. A separately developed plugin performs reviews in the user's
environment. This repository prepares report persistence; ingestion and history
are not implemented.

## Decisions

- [ADR-0002-modular-monolith](adr/ADR-0002-modular-monolith.md)
- [ADR-0008-git-trunk-based-development](adr/ADR-0008-git-trunk-based-development.md)
- [ADR-0009-ract-vite-webapp](adr/ADR-0009-ract-vite-webapp.md)
- [ADR-0010-local-first-prototype](adr/ADR-0010-local-first-prototype.md)
- [ADR-0022-frontend-layered-vertical-slices](adr/ADR-0022-frontend-layered-vertical-slices.md)
- [ADR-0023-frontend-reusable-logic](adr/ADR-0023-frontend-reusable-logic.md)
- [ADR-0024-react-hook-form](adr/ADR-0024-react-hook-form.md)
- [ADR-0025-tanstack-query-frontend-server-state](adr/ADR-0025-tanstack-query-frontend-server-state.md)
- [ADR-0026-frontend-entity-action-surfaces](adr/ADR-0026-frontend-entity-action-surfaces.md)
- [ADR-0028-public-identifiers-at-the-api-boundary](adr/ADR-0028-public-identifiers-at-the-api-boundary.md)
- [ADR-0034-inspectable-development-harness](adr/ADR-0034-inspectable-development-harness.md)
- [ADR-0037-plugin-console-and-product-hierarchy](adr/ADR-0037-plugin-console-and-product-hierarchy.md)
- [ADR-0038-review-reports-findings-and-evidence](adr/ADR-0038-review-reports-findings-and-evidence.md)
- [ADR-0039-authentication-and-attachment-retention](adr/ADR-0039-authentication-and-attachment-retention.md)

## Diagrams

- [System context](diagrams/01-c4-system-context/README.md)
- [Containers](diagrams/02-c4-container/README.md)
- [Report relationships](diagrams/03-erd-core-mvp/entity-relation-diagram.md)
- [Console navigation](diagrams/05-c4-frontend-navigation/README.md)

Only current decisions are listed. The prior baseline is recoverable using
[the recovery guide](../baseline-recovery.md).
