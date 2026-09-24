---
name: create-page
description: Analyze, plan, and implement standard Featurewise React pages from a page location and page description. Use when Codex is asked to create, add, build, replace, or wire a routed platform page under frontend/src/pages; configure its PageStructure, PageHeader, Breadcrumb, actions, canvas body, routing, navigation, data flow, states, and tests; or determine whether shared components, frontend architecture, navigation, or backend contracts must change before the page can be implemented.
---

# Create Page

Create one standard Featurewise platform page from two inputs:

- **Page location:** a route path, pathname template, router destination, or page-slice path.
- **Page description:** the page goal, visible content, actions, behavior, and relevant product context.

Use an approval-gated workflow: analyze and plan first, then implement only after the user explicitly confirms that plan.

## Enforce the confirmation gate

- Treat the first invocation as read-only analysis and planning, even when it also says "implement" or "create."
- Do not edit files, add dependencies, run generators that change tracked files, or wire routes before presenting the plan.
- Do not treat the initial request as confirmation. Require a later user message that approves the presented plan.
- Treat a user message such as "implement the plan" as confirmation only when the exact plan is already present in the conversation and no material decision remains open.
- If the confirmation changes the requested behavior or scope, update the analysis and plan and request confirmation again.

## Validate the inputs

1. Require both page location and page description.
2. If either is missing, ask only for the missing input and stop before repository mutation.
3. Normalize the location against the router:
   - For a URL or pathname template, identify the owning route and expected page slice.
   - For a filesystem location, identify or infer the corresponding route.
   - If multiple routes or slices remain plausible after inspection, present the concrete candidates and ask which one is intended.
4. Extract success criteria from the description: audience, content, actions, data, states, navigation entry points, and completion behavior.

## Phase 1: perform complete read-only analysis

Announce that this skill requires an analysis and confirmation pause. Then gather repository truth before asking questions.

### Read architecture and current state

Always read:

- `AGENTS.md`;
- `docs/architecture/adr/ADR-0009-ract-vite-webapp.md`;
- `docs/architecture/adr/ADR-0022-frontend-layered-vertical-slices.md`;
- `docs/architecture/diagrams/05-c4-frontend-navigation/README.md`;
- the current worktree status.

For domain pages also read ADR-0037, ADR-0038 and ADR-0039 in the architecture catalog.

Read every additional ADR and diagram relevant to the page's domain or workflow. For reports, findings, decisions, authentication, attachments, or domain-state behavior, trace the accepted backend boundary rather than inferring it from UI copy. Do not propose report ingestion, history queries or decision mutations before a real backend vertical slice supports them.

Inspect at minimum:

- router definitions, lazy route modules, authentication boundaries, and not-found behavior;
- `AppShell`, `PageStructure`, `PageHeader`, `Breadcrumb`, and the current sidebar/navigation model;
- the closest existing page slice and its tests;
- relevant feature `api`, `model`, `ui`, and public exports;
- existing shared components and semantic variables;
- backend endpoints, DTOs, errors, and preconditions when the page reads or mutates server state.

Preserve unrelated worktree changes. Do not assume uncommitted files belong to this task.

### Trace whether the platform supports the page

Preserve `/projects/:projectKey/features/:featureKey`. The current Feature page
shows title actions and an explicit unavailable history state; it sends no report,
finding, attachment or ingestion requests. The plugin is developed separately.
Projects are organization-scoped and may be empty; auth has no single project.

Determine and report:

- the exact route, route parameters, deep-link behavior, and lazy-loading boundary;
- authentication and authorization assumptions allowed by the local-first MVP scope;
- how the page enters and remains selected in global navigation;
- required server data, query keys, cache behavior, mappings, and mutations;
- the owner of every business rule and validation decision;
- breadcrumb items, one page-level heading, optional subtitle, and page actions;
- body sections and loading, empty, error, not-found, disabled, pending, and success states that actually apply;
- responsive, keyboard, focus, and accessible-name requirements;
- test seams and acceptance criteria.

Classify support as exactly one of:

1. **Supported as-is:** existing routes, shell, components, and APIs are sufficient.
2. **Supported with page-local changes:** only the page slice and existing public feature APIs need composition.
3. **Shared capability required:** a domain-neutral shared component must be added or generalized.
4. **Architecture or contract change required:** routing, shell ownership, navigation, API, DTO, backend behavior, or an accepted ADR must change.
5. **Blocked by an accepted decision or local-first MVP scope:** stop and identify the conflict.

### Audit PageStructure ownership carefully

`PageStructure` owns the single `main` landmark and is mounted by `AppShell` above the route `Outlet`. Do not assume an outlet page can set outer `pageHeaderProps` merely by nesting content.

- Inspect the actual route and shell composition for the requested location.
- Define how route-specific header data reaches `PageStructure`, or identify that capability as an architecture gap.
- Never add a second `main`, duplicate the global Header or Sidebar, or recreate PageHeader styling inside a page.
- Keep the white PageHeader and divider before the canvas body. Use Breadcrumb as the page heading, the optional muted subtitle, and arbitrary action content through the established API.

### Audit component capability

- Inventory existing `shared/ui` components before proposing new UI.
- Prefer composition over variants or new primitives.
- Generalize only domain-neutral behavior in `shared/ui`; keep page copy, columns, data mapping, and orchestration in the owning slice.
- If a reusable component must be created or substantially revised, name the exact contract change in the plan. After approval, load and follow `$create-component` before implementing that component.
- Do not add a dependency unless the existing React, Lucide, CSS, Storybook, and test stack cannot satisfy the requirement; explain why in the plan.

### Resolve doubts before planning

Separate unknowns into:

- **Discoverable facts:** continue inspecting routes, types, schemas, components, tests, and ADRs.
- **Product choices or tradeoffs:** ask focused questions only when the answer materially changes behavior, public interfaces, architecture, or scope.

If an accepted ADR conflicts with the requested page, stop. Cite the ADR and propose either a compliant page design or an ADR amendment. Do not silently diverge.

## Present the analysis and plan

Do not implement in this phase. Present:

1. **Request interpretation:** normalized page location, goal, users, and success criteria.
2. **Current support assessment:** one of the five support classifications with evidence.
3. **Impact analysis:** routing/navigation, PageStructure/PageHeader, feature slices, shared components, backend contracts, and documentation.
4. **Doubts and decisions:** resolved facts, explicit assumptions, and any questions still requiring an answer.
5. **Decision-complete implementation plan:**
   - route and navigation changes;
   - page and feature-slice responsibilities;
   - data flow and public interfaces;
   - header breadcrumb, subtitle, actions, and canvas body composition;
   - applicable states, failure modes, and accessibility behavior;
   - shared-component or ADR work, if any;
   - tests, responsive inspection, and verification commands.
6. **Acceptance criteria:** observable outcomes that determine completion.

If a material question remains open, ask it and withhold the final plan until answered. Otherwise end with a concise confirmation request and state that no implementation changes have been made.

## Phase 2: implement only after confirmation

After explicit approval:

1. Recheck the worktree and the source files used by the plan in case they changed.
2. Implement only the confirmed scope. Surface any new material conflict instead of expanding silently.
3. Follow the dependency direction `app -> pages -> features -> shared`.
4. Create only needed slice segments:

       frontend/src/pages/<page-name>/
         ui/<PageName>Page.tsx
         ui/<PageName>Page.module.css
         <optional focused test files>
         index.ts

5. Keep route registration and router adapters in `app`; keep page orchestration in `pages`; keep reusable business capability in `features`; keep generic transport and UI in `shared`.
6. Keep backend DTOs in feature API segments and map them before exposing UI models.
7. Use TanStack Query for server state and existing query-option factories. Do not copy server state into local state without a demonstrated editing need.
8. Compose the confirmed PageHeader through the supported PageStructure ownership path. Provide Breadcrumb, optional subtitle, and action content; render effective page content in the canvas body.
9. Preserve exactly one page-level heading, one `main`, router-neutral shared UI, semantic variables, CSS Modules, and named Lucide imports.
10. Implement only applicable states. Use precise Featurewise vocabulary and sentence-case operational copy. Feature pages show title actions and unavailable review history. Persistence terminology is review report, finding, source, evidence, attachment and finding decision.
11. Update sidebar selection, navigation actions, prefetching, and cache behavior only when the confirmed route requires them.
12. Update an accepted diagram or add/amend an ADR when the implementation makes a significant architectural decision.

## Test and inspect

Add focused tests for the behavior introduced by the page:

- route matching, parameters, and deep links;
- header title, subtitle, actions, and main-body composition;
- loading, empty, error, not-found, and mutation states that apply;
- query enablement, mapping, cache invalidation, and retry behavior when contract-critical;
- user interactions, keyboard behavior, focus, and accessible naming;
- navigation selection and intent-prefetch behavior when changed.

Do not create Storybook stories for route pages by default. Add or update stories when shared components change, following `$create-component`.

Run from `frontend/`:

    npm run lint
    npm test -- --run
    npm run build

When shared components or Storybook stories change, also run:

    npm run test-storybook -- --run
    npm run build-storybook

Run relevant backend build and tests if backend code or contracts change. For layout-sensitive work, inspect the actual page at representative desktop and mobile widths, including action wrapping, focus, empty/error states, and overflow.

## Report completion

Report:

- implemented route and page location;
- PageStructure/PageHeader and navigation wiring;
- feature, shared-component, backend, or ADR changes;
- tests and responsive inspection performed;
- verification results and any pre-existing warnings;
- intentionally deferred behavior.

Do not claim completion while required acceptance criteria, tests, or approved architecture work remain unfinished.

## Example invocation

    Use $create-page.
    Page location: /projects/:projectKey/features/:featureKey?tab=context
    Page description: Let the user edit supporting feature context, manage selected and archived files, and save changes for future analyses.
