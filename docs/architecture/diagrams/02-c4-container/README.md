# Local-first containers

```mermaid
flowchart LR
  Browser[React and Vite Console] -->|REST / public keys| API[NestJS modular monolith]
  API -->|Prisma| DB[(PostgreSQL)]
  API --> Storage[Compiled Storage module]
  Storage -. Signed access / future attachment flow .-> S3[(Private S3 originals)]
```

Auth, Workspace, Features, Database, Storage and Health remain active modules.
Login and container management require no S3 configuration. SQL migrations and
the deterministic harness never call S3. Report tables do not expose HTTP APIs.
