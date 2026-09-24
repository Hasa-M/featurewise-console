# Isolated Console harness

From `backend/`, with Node/npm, installed backend/frontend dependencies and Docker
Desktop: `npm run harness:doctor`, then `npm run harness:up`.

The Compose project is `featurewise-console-harness`, using its own volume.
The older harness volume and `.harness/` files are not reused or reset.
All new credentials, logs, fixtures and test evidence live in `.harness/console/`.
Never point the harness at normal development data or load a cloud credentials file.

| Surface | Address |
| --- | --- |
| Console | http://127.0.0.1:5174 |
| API / health | http://127.0.0.1:3100 |
| Swagger / JSON | http://127.0.0.1:3100/docs, /docs-json |
| PostgreSQL | 127.0.0.1:5434, database/user featurewise_harness |
| Prisma Studio | http://127.0.0.1:5556 after harness:studio |

Login: `harness.operator`, with the generated password in
`.harness/console/environment.json`. `harness.other` belongs to a different
organization; `harness.empty` initially has no projects. Their passwords are the
same isolated fixture password. Never print credentials, tokens or signed URLs
in reports. Read generated public keys from `.harness/console/fixtures.json`.

`harness:seed` fills missing fixture containers without overwriting user edits.
Ordinary `prisma:seed` creates no test projects or reports. `harness:inspect --
--feature FEAT-1` exports read-only database state including reports and originals.
There is no input capture, repository, conversion, live cloud or cleanup capability.

`harness:status` checks owned processes and database. `harness:down` stops them,
preserving the dedicated volume. `harness:reset` stops the harness and removes
only the `featurewise-console-harness` volume, reapplies migrations and reseeds.
Stop Studio before reset. Preserve useful test artifacts before resetting.
On Windows use `npm.cmd` if the PowerShell wrapper loses forwarded arguments.

## Tests

```text
npm run harness:test
npm run harness:test:postgres
npm run harness:test:http
npm run harness:typecheck
```

Tests use real PostgreSQL and NestJS with no cloud-capable storage implementation.
Migration fixtures create `console_migration_<timestamp>` databases in the same
dedicated container. They remain inspectable until harness reset. Migration
inventories and Jest JSON reports are in `.harness/console/`. The new migration
also runs on a fresh database during harness initialization.

Use Chrome DevTools MCP when exposed for relevant UI checks. If unavailable,
record `not_run: Chrome DevTools MCP unavailable`; existing Playwright tooling
can provide separate browser automation evidence. Verify login, zero/multiple
projects, create/rename/navigation, unavailable history, reload, fallback and logout.
Record expected/actual results, timestamp, public keys and screenshots inside the
harness. Check that the browser makes no requests to removed/deferred capabilities.
Do not claim a browser check passed if it did not run.
