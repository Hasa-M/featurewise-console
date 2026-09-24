# Recovering the previous baseline

Before this refactor, the local worktree was on `main` at
`a8ebc3c0cc7359c134eb30eda8810d456bb49961`. Only untracked `docs/learning/`
was present; it was left untouched. No ordinary database, ignored configuration
or AWS resource was changed by this refactor.

The remote `deprecated` branch preserves that exact former `main` commit.
The refactored Console continues on `main`; `deprecated` is an archive.
Use `git fetch origin deprecated` and `git show origin/deprecated:<path>` to
inspect the previous implementation without changing the working tree.

Local preserved refs:

- branch `archive/pre-console-refocus-20260924`;
- tag `baseline/pre-console-refocus-20260924`.

Verified full-history bundle:
`.harness/console-refocus-baseline-20260924/baseline.bundle`

SHA-256: `B60906DE9E4BE8FCD4ACAAF008EE93A31DA161C080832F4CACDE714780C78E78`.

Verify with `git bundle verify <path>`. Inspect removed ADRs or code using
`git show baseline/pre-console-refocus-20260924:<path>`, or clone the bundle
into a separate directory. Do not reset the working tree to recover documents.
The bundle preserves tracked history, not ignored files or untracked work.
The former harness volume and its existing `.harness/` files were preserved;
the new harness owns a separate volume and `.harness/console/` artifacts.

Before applying the new migration to an existing database with derivatives,
explicitly set DATABASE_URL for that database and run from `backend/`:

```text
npm run storage:export-retired
```

This writes a recoverable JSON inventory in `.harness/retired-derivatives/`,
reads it back to verify SHA-256, and stores a database receipt. Preserve the
reported file and hash before `prisma migrate deploy`. The migration aborts
without a matching export and never deletes S3 bytes. If an interrupted Prisma
deploy records a failed migration, inspect it and resolve it as rolled back
before retrying after export. Database restoration is separate from Git recovery.
