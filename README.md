# Featurewise

A working Console and backend for organizing review history by organization,
project and feature. A separately developed plugin will produce reviews in the
user's environment.

Available now: operator login/session/logout, organization rename, multiple
projects with creation/rename, feature creation/rename/soft deletion, public-key
routes and the existing design system. A feature requires only a title.

PostgreSQL is ready for immutable reports, findings, report-local evidence,
retained S3 attachments and append-only human decisions. **Report reception and
history are not available yet**; the feature page states this explicitly.

## Local development

Use the [isolated harness](docs/testing/development-harness.md) for the fastest
repeatable setup, with Node/npm and Docker Desktop installed:

```text
cd backend
npm install
npm run prisma:generate
cd ../frontend
npm install
cd ../backend
npm run harness:up
```

Console: http://127.0.0.1:5174. API: http://127.0.0.1:3100.
Generated fixture credentials remain in ignored `.harness/console/environment.json`.
The harness cannot call S3. Normal development setup is described in
[backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
Login and container management work without S3 configured.

## Documentation

- [Architecture and ADR catalog](docs/architecture/README.md)
- [Verification strategy](docs/testing/integration-strategy.md)
- [Prior baseline and migration recovery](docs/baseline-recovery.md)
- [Plugin/history integration TODO](docs/TODO.md)
- [License provenance and third-party notices](docs/licensing.md)

Original repository code retains the [PolyForm Noncommercial License 1.0.0](LICENSE).
MIT is intended for the separately developed plugin, in its own repository.
Third-party packages and fonts retain their own licenses and attribution. This
remains a local-first prototype, not a public production deployment.
