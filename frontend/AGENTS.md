# AGENTS.md - Frontend-specific instructions

These instructions extend the repository-root `AGENTS.md` for work under `frontend/`. Read and follow the root instructions first; do not duplicate their general project rules here.

## Required architecture reading

Before designing or implementing non-trivial frontend work, read:

- `docs/architecture/adr/ADR-0009-ract-vite-webapp.md`;
- `docs/architecture/adr/ADR-0022-frontend-layered-vertical-slices.md`;
- `docs/architecture/adr/ADR-0023-frontend-reusable-logic.md`.

Keep the dependency direction `app -> pages -> features -> shared`. The frontend is one application; do not introduce microfrontends.

## Utilities and custom hooks checklist

For every frontend change that adds logic:

1. Inspect the owning feature's `lib` and `model` segments, plus `shared/lib` and `shared/model`, before creating a utility or custom hook.
2. Reuse an existing implementation when its contract fits. Do not duplicate behavior under a new name.
3. Decide whether the logic is a pure utility or a React hook. Logic that uses React state, context, effects, refs, or other hooks must be a custom hook.
4. Place the code at its narrowest valid owner:
   - feature-specific utilities in `features/<feature>/lib/`;
   - feature-specific hooks, mappings, and state in `features/<feature>/model/`;
   - only domain-neutral utilities in `shared/lib/`;
   - only domain-neutral reusable hooks in `shared/model/`.
5. Give each extracted utility or custom hook one implementation file. Use descriptive kebab-case filenames; custom hooks must use the `use-*.ts` naming form and a `use*` export.
6. Export shared utilities and hooks through their segment `index.ts`. Do not add a global `shared/index.ts`, and do not create empty segments in anticipation of future work.
7. Add focused tests for meaningful branching, state transitions, effects, cleanup, or edge cases. Colocate tests as separate `<name>.test.ts` or `<name>.test.tsx` files.

Extract logic when it is reusable, independently testable, duplicated, or materially improves page or component readability. Trivial render-only helpers and event handlers tightly coupled to one component may stay colocated. Pages must remain route-level composition rather than containers for reusable product logic.

## API ownership

`shared/api` is only the domain-neutral HTTP transport: base URL handling, request execution, JSON parsing, authentication-header attachment, and normalized errors.

Keep endpoint functions and wire DTOs in the owning feature's `api` segment. Keep session state and authentication hooks in the auth feature's `model` segment, with application-wide provider or router wiring in `app`. Page and feature UI must not call `shared/api` directly.

Do not add frontend business rules that belong to the backend. Keep the single-operator authentication scope in ADR-0039; roles and permissions remain deferred.
