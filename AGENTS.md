# AGENTS.md — Featurewise

Canonical instructions for coding agents. CLAUDE.md imports this file.

Featurewise retains a local-first React/Vite Console and NestJS modular monolith
for authentication and Organization → Project → Feature management. A separate
plugin, developed elsewhere, performs reviews in the user's environment.
This repository prepares report persistence; ingestion and history are deferred.

## Architecture first

Read relevant ADRs and diagrams in `docs/architecture/` before non-trivial work.
ADR-0037 defines product scope, ADR-0038 report/evidence/decision persistence,
ADR-0039 auth and attachment retention. The active catalog contains current
decisions only; use `docs/baseline-recovery.md` for the earlier baseline.
Do not silently diverge from an accepted decision. Explain a conflict and propose
an explicit update, unless the user already authorized that exact change.

## Boundaries and invariants

- Keep NestJS module internals private; use exported public APIs across modules.
- The backend owns authorization and persistence; neither it nor the Console
  executes reviews, selects models, prepares inputs or connects to repositories.
- One operator belongs to one organization. Organizations may have multiple
  projects; projects may initially have no features. A feature requires a title.
- Resolve every project through the current organization and every nested
  feature through its parent. Auth/session responses do not contain a project.
- API and frontend identities use immutable public keys; UUIDs stay internal.
- Reports/findings/sources/evidence/attachments are immutable. Decisions are
  append-only accepted/dismissed/resolved/deferred; newest createdAt then
  publicNumber determines disposition. No cross-report finding matching.
- Evidence stays inside its report. Attachments reference retained originals
  of that same feature. Local code uses relative paths/excerpts; MCP uses references
  without copied content. Verification metadata comes from the producer.
- Keep Storage compiled and tested, with private originals, unique keys, exact
  versions and checksums. Configuration is optional for login/container work.
  No SQL migration deletes S3 objects. Confirmed original references and first-use
  markers are immutable. Export and verify retired derivative inventory before
  applying the incremental migration to existing data.
- Passwords use standard Argon2id. Seed initializes an organization/operator only,
  preserves user edits on rerun and reads the initial password from environment.

## Scope guards

Do not implement placeholder report ingestion, history or finding-decision APIs.
No editable specification/context, repository connector, backend analysis lifecycle,
LLM log, conversion, selection or physical cleanup capability. No queues, workers,
teams, roles, invitations, 2FA, password reset, organization selector or onboarding.
No project/report deletion or public production deployment. Feature soft deletion
is retained. Plugin integration and report history require a subsequent task.

## Frontend

Keep `app -> pages -> features -> shared`, typed feature APIs, CSS Modules,
semantic variables, Lucide, Geist, shared UI and Storybook. Use React Hook Form
and Zod for forms; TanStack Query for server state. AppShell/PageStructure own
the single main landmark; pages register breadcrumbs/actions through the existing
header provider. Preserve `/login`, `/`, `/projects/:projectKey` and
`/projects/:projectKey/features/:featureKey` and honest unavailable history copy.

## Workflow and checks

Follow ADR-0008: trunk-based development and `type(scope): imperative description`.
Preserve unrelated changes and ignored files. Prefer small reviewable changes.
No dependencies without explaining why. TypeScript strict; avoid `any`.
Use `docs/testing/development-harness.md` for isolated PostgreSQL/API inspection.
Never substitute ordinary databases or real S3 resources for deterministic tests.
Use Chrome DevTools MCP for relevant browser work when exposed; report unavailable
checks honestly. Existing Playwright tooling can provide separate browser evidence.

From `backend/`: `npm run build`, `npm test -- --runInBand`,
`npm run test:e2e -- --runInBand`, `npm run lint` (no autofix),
`npm run harness:up`, `npm run harness:test`, `npm run harness:typecheck`.
Prisma: inspect schema/migrations before database work; `prisma:generate` and
`prisma:seed` are available. Never rewrite historical migrations.
From `frontend/`: `npm run build`, `npm run lint`,
`npm test -- --run --project=unit`, `npm run build-storybook`,
`npm run test-storybook -- --run`.
Record expected/actual results and evidence in the harness; repeat checks only
after relevant changes, failures or unresolved concerns.
