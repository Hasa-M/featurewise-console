# ADR-0026: Use shared entity actions and page header registration

Date: 2026-09-24

Status: accepted

## Context

Metadata actions are invoked from pages, cards and the persistent navigation shell.

## Decision

Use provider-backed actions owned by the Workspace and Features slices.
Organization rename and project rename use a quick-edit modal; project creation
uses a name-only modal. Feature creation/rename uses a title-only modal.
Feature soft deletion uses a confirmation modal. Do not offer project or report
deletion. Shared components own modal mechanics; slices own copy, schemas, API,
mutations and cache updates using React Hook Form, Zod and TanStack Query.

After project creation refresh the home list and sidebar; the user can open its
card. Feature creation opens the feature. Rename stays on the current surface.
Deleting the active feature returns to its parent project.

AppShell mounts PageStructure and its single `main` landmark. Lazy pages register
PageHeader props via the shared registration provider. Breadcrumbs, subtitle and
actions use this API; an old page cannot clear a newer page's header.

## Consequences

Consistent actions reuse the existing design system without page-specific modal or header implementations. Metadata changes never alter historical report results.
