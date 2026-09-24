# ADR-0037: Separate plugin reviews from the Console

Date: 2026-09-24

Status: accepted

## Context

Review execution belongs in the user's environment. This repository retains a
working Console and backend as the foundation for storing and consulting reviews
produced by a separately developed plugin.

## Decision

Keep Organization → Project → Feature. Initial setup creates one named
organization and its operator; an organization can contain zero or more projects,
and a project can contain zero or more features. A feature requires only a title.

The React/Vite Console uses the NestJS REST/JSON backend for authentication,
organization rename, project list/detail/create/rename, and feature
list/detail/create/rename/soft deletion. Public keys identify all API resources.
Authorization resolves each project through the authenticated organization.

The plugin is developed separately and performs reviews in the user's environment.
This backend does not execute models, prepare analysis inputs, own editable
specifications/context, or connect to repositories. It has no execution lifecycle,
provider configuration, prompt registry, call logs, queue, or worker.

Keep `/login`, `/`, `/projects/:projectKey`, and
`/projects/:projectKey/features/:featureKey`. The feature page explicitly says
review history is unavailable. Plugin reception, report/history/decision APIs and
their UI are deferred; database tables do not imply available endpoints.

## Consequences

The backend, PostgreSQL, authentication, S3 module, Console shell, design system,
and isolated testing harness remain active. Project/report deletion, onboarding,
organization selection, teams, roles, and public production deployment are outside
this refactor. Plugin integration and history can be implemented as subsequent
vertical slices without restoring backend review execution.
