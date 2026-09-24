# ADR-0022: Organize the Frontend as Layered Vertical Slices

Date: 2026-07-17

Status: accepted

## Context

The phase 1 frontend must remain understandable for a solo developer while growing across authentication, organization, project, feature, and future report-history workflows.

A single application-wide collection of components, API calls, and types would make ownership unclear. Copying environment, token, or provider setup into Storybook would also allow isolated components to behave differently from the application.

## Decision

Organize frontend code into `app`, `pages`, `features`, and `shared` layers. Dependencies flow only in that direction:

`app -> pages -> features -> shared`

Pages and features are named slices. A slice may contain these segments when needed:

- `api`: endpoint functions and wire DTOs;
- `model`: frontend models, mappings, hooks, and state;
- `ui`: React components and CSS Modules;
- `lib`: private pure utilities;
- `index.ts`: the slice public API.

The generic HTTP transport lives in `shared/api`. Feature UI does not call it directly: data flows from UI through the feature model and API boundary. Backend DTOs remain in the API segment and are mapped before becoming UI contracts.

Reusable components live in `shared/ui`. Use named Lucide React imports for icons. Colocate Component Story Format stories with reusable components.

Platform tables are configured consumers of the reusable `shared/ui/table` primitive. When a concrete use case needs new table behavior, generalize the domain-neutral capability at the shared component level first. The consuming slice owns its columns, cell content, data mapping, and orchestration; it must not fork sorting, row-action, sizing, or state behavior into a page-specific table.

Use Storybook with the React/Vite framework as the component workbench. Token foundation stories live with the global styles. Storybook imports the same global CSS entry point and uses the same Vite aliases and CSS Modules configuration as the application. Do not create Storybook-only tokens, themes, or provider implementations.

Use the Storybook Vitest addon to run stories in browser mode. Every story acts as a render smoke test and participates in configured accessibility checks. Add `play` interaction tests selectively when a real browser or the Storybook interaction debugger provides material value, such as keyboard navigation, popovers, complex selection, or rich editing workflows. Keep focused Vitest and Testing Library tests as the primary component test suite; do not duplicate simple prop, callback, or rendering assertions in story `play` functions.

## Consequences

- Product capabilities have explicit ownership and a small public surface.
- REST response shapes do not leak into visual components.
- Shared infrastructure cannot depend on product-specific code.
- Table behavior remains consistent across use cases while domain-specific content stays in its owning slice.
- Components and design tokens can be inspected independently without creating a second frontend environment.
- Story rendering and accessibility regressions can be caught in a real browser, while selective interaction tests keep the suite useful without duplicating unit coverage.
- The folder vocabulary and mapping layer add some ceremony; unused slice segments must not be created.
- Import boundaries are initially enforced through review and documentation. Automated boundary linting can be added if violations become recurring.
