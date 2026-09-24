# Verification strategy

Unit tests cover public-key parsing, organization/parent scoping, retained storage
SDK behavior, form schemas, resource mapping and shared UI. HTTP tests verify
actual Nest validation/auth guards without a configured S3 bucket.

The [isolated harness](development-harness.md) tests PostgreSQL invariants:
incremental migrations from empty and previous schemas, missing/stale inventory
rejection, original-reference preservation, repeatable concurrent Argon2id seed,
zero/multiple projects, report-local evidence, same-feature attachments,
immutable results and separate append-only decisions. Real HTTP integration
checks login/session with zero/one/multiple projects, the second project,
organization isolation, container mutations, public keys and feature soft deletion.

Frontend route tests cover auth/logout/cache isolation, empty/error/fallback states,
project/feature creation and rename, breadcrumbs, one main landmark and no removed
requests. Storybook uses its browser test project and the shared Vite configuration.
Browser verification uses isolated fixture data and reports its own evidence.
SDK substitution and deterministic tests do not claim live S3 transport coverage.
Builds, typechecks and lint run without lint autofix. Do not rewrite historical
migrations or use ordinary databases for test data.
