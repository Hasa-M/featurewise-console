# Featurewise Console

React + Vite + TypeScript; app/pages/features/shared layering. Reuse the existing
shell, CSS Modules, shared tokens, Lucide icons, bundled Geist fonts and Storybook.

`npm install`, then `npm run dev` for ordinary local development (port 5173,
API proxy localhost:3000). The isolated harness starts a separate Console on 5174
with API 3100. See [the harness runbook](../docs/testing/development-harness.md).

Routes: `/login`, `/` (projects), `/projects/:projectKey` (features), and
`/projects/:projectKey/features/:featureKey` (title and unavailable history).
No calls are made to deferred report, upload or review capabilities.

Checks: `npm run build`, `npm run lint`, `npm test -- --run --project=unit`,
`npm run build-storybook`, `npm run test-storybook -- --run`.
The Storybook suite uses the installed Playwright Chromium browser.

The build includes `public/THIRD_PARTY_NOTICES.txt`; regenerate it with
`node ../scripts/generate-third-party-notices.mjs` after dependency changes.
