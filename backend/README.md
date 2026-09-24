# Featurewise backend

NestJS/TypeScript modular monolith with Auth, Workspace, Features, Storage,
Database and Health modules. PostgreSQL stores containers and report foundations.
There are no report/history/decision endpoints or review execution services.

## Normal development

Install dependencies, copy `.env.example` to `.env`, configure PostgreSQL and
AUTH_TOKEN_SECRET, then run `npm run prisma:generate`. For an existing database,
follow [the inventory and recovery guide](../docs/baseline-recovery.md) before
`npx prisma migrate deploy`; historical migrations remain unchanged.

Set SEED_USERNAME (default `dev.operator`), SEED_ORGANIZATION_NAME (default
`Featurewise`) and SEED_PASSWORD for first setup. `npm run prisma:seed` creates
only the organization/operator. Keep the username stable; reruns preserve name,
password and activation edits. Projects are created through the Console.
Start with `npm run start:dev` (default port 3000).

S3 configuration is optional. The retained adapter supports private exact-version
access and immutable original keys; upload/report-link flows are deferred.
There is no conversion, cleanup timer or cloud migration operation.

## Implemented API

| Method | Path |
| --- | --- |
| POST | /auth/login |
| GET | /auth/me |
| GET, PATCH | /organizations/:organizationKey |
| GET, POST | /organizations/:organizationKey/projects |
| GET, PATCH | /projects/:projectKey |
| GET, POST | /projects/:projectKey/features |
| GET | /projects/:projectKey/features/:featureKey |
| GET, PATCH, DELETE | /features/:featureKey |
| GET | /health, /health/database |

Auth uses bearer JWTs; logout clears the client session. Names/titles are bounded,
nonblank strings. Unknown fields are rejected. Feature deletion is logical only.
Use public keys everywhere at the HTTP boundary. Enable local Swagger using
SWAGGER_ENABLED=true; `/docs` and `/docs-json` describe only implemented routes.

## Verification

`npm run build`, `npm run lint`, `npm test -- --runInBand`,
`npm run test:e2e -- --runInBand`, `npm run harness:typecheck`.
Use [the isolated harness](../docs/testing/development-harness.md) for database
migration, report integrity, seed and HTTP integration checks.
