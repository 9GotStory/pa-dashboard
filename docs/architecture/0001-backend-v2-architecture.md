# ADR-0001 — PA Dashboard Backend v2 Architecture

- Status: Accepted
- Date: 2026-09-11
- Scope: PA Dashboard Backend v2 migration
- Legacy production baseline: `pa-legacy-production-2026-09-11`
- Legacy source SHA: `a5f6a3e320d6a5f42e6f1b7867b431959d0ce5a4`

## Context

PA Dashboard currently uses:

- Next.js 16.1.6
- React 19.2.3
- GitHub Pages static export
- Google Apps Script backend
- Google Sheets persistence
- MOPH Open Data API as upstream data source

The migration introduces a self-hosted backend while preserving legacy
production until parity, recovery, and production cutover gates pass.

The platform requirements are:

- security-first
- Simple — Structured — Sustainable
- rootless Podman
- SELinux Enforcing
- existing Cloudflare Tunnel and Traefik
- no public database exposure
- no Podman socket exposure
- no production Git worktree runtime
- no unnecessary supporting infrastructure

## Decision

### Frontend

The existing Next.js application remains at the repository root.

Target runtime:

- Next.js 16
- React 19
- Node.js 24 LTS
- self-hosted Node runtime

The frontend is not moved into a `frontend/` directory during migration.

### Backend

A separate backend package is introduced under:

`backend/`

Technology:

- Node.js 24 LTS
- Fastify 5
- TypeScript

Responsibilities are separated as follows:

- `backend/src/app.ts`
  - builds the Fastify application
  - does not bind a network socket
- `backend/src/server.ts`
  - process entry point
  - binds the listener
  - handles graceful shutdown
- `backend/src/config/`
  - validated runtime configuration
- `backend/src/db/`
  - PostgreSQL access and transaction helpers
- `backend/src/modules/`
  - HTTP and business capabilities
- `backend/src/sync/`
  - MOPH synchronization and KPI calculation
- `backend/src/observability/`
  - health and metrics
- `backend/migrations/`
  - ordered database migrations
- `backend/test/`
  - unit, integration, and contract tests

### Database

Selected database:

- PostgreSQL 18

The application uses a relational model with JSONB for variable MOPH fields.

Core logical entities:

- `app_settings`
- `kpi_categories`
- `kpi_definitions`
- `facilities`
- `tambons`
- `sync_runs`
- `source_records`
- `kpi_results`
- `app_state`

The design does not create one database table per KPI.

Frequently queried/common source fields are stored relationally.

Variable upstream fields are preserved in `raw_payload JSONB`.

### Dataset activation

A synchronization run is isolated from the currently active dataset.

Conceptually:

1. create a new `sync_run`
2. fetch physical MOPH sources
3. validate and persist source records
4. calculate derived and virtual KPIs
5. persist KPI results
6. validate run completeness
7. atomically switch the active sync-run pointer

A partial or failed synchronization must not become publicly visible.

### KPI contract

Backend v2 targets the intended source contract:

- 18 physical source KPIs
- 34 virtual KPIs
- 52 total KPI definitions

The legacy production registry currently exposes only 30 virtual KPIs.

The following four PCV KPIs are known legacy configuration drift and must not
be intentionally omitted from Backend v2:

- `s_epi1__pcv1`
- `s_epi1__pcv2`
- `s_epi1__pcv3`
- `s_epi2__pcv4`

### Config-driven behavior

The migration preserves config-driven KPI behavior.

KPI registry, category metadata, source discovery, quarterly settings,
target-month configuration, effective-quarter configuration, virtual KPI
source mapping, and source-id filtering must not be replaced with a fully
hardcoded KPI implementation.

### API boundary

Browser-facing requests use a same-origin API:

`/api/v1/*`

The backend API is not given a separate public hostname.

Expected initial endpoints include:

- `GET /api/v1/dashboard`
- `GET /api/v1/facilities`
- `GET /api/v1/tambons`
- `GET /api/v1/kpis`
- `GET /api/v1/sync-status`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

Exact response schemas are implementation contracts and require their own
tests.

### Container topology

Target runtime containers:

- `pa-dashboard-web`
- `pa-dashboard-api`
- `pa-dashboard-db`

The API image is also used by a scheduled one-shot synchronization job.

A permanent synchronization worker is not introduced.

### Network topology

Shared `edge` network:

- Traefik
- `pa-dashboard-web`

Private application network:

- `pa-dashboard-web`
- `pa-dashboard-api`
- `pa-dashboard-db`

Network rules:

- public -> web: allowed through existing edge
- public -> API directly: prohibited
- public -> database: prohibited
- web -> API: allowed
- API -> database: allowed
- host database port: none
- host API port: none
- firewall widening: none by default

### Deployment

Production runtime owner:

`websvc`

Development owner:

`thanakorn`

Production must use immutable OCI application images.

Production application containers must not execute from the Git worktree.

Production images must ultimately be digest-pinned before deployment.

### Synchronization

Synchronization is executed as a scheduled systemd one-shot workload.

The one-shot workload reuses the backend/API image with a different command.

No Redis, message queue, or permanent worker daemon is introduced without a
demonstrated requirement.

### Backup and recovery

PostgreSQL recovery is based on logical database backup.

Flow:

PostgreSQL -> `pg_dump` -> controlled backup directory -> Restic

The raw live PostgreSQL data volume is not treated as the application
database backup artifact.

Adding application backups to the existing Restic manifest requires a
separate explicit gate and recovery proof.

A restore test is mandatory before production cutover.

### Observability

Initial observability remains intentionally small:

- web health check
- API liveness
- API readiness
- synchronization run audit
- synchronization failure visibility
- minimal Prometheus metrics

The migration does not introduce:

- Loki
- Tempo
- Redis
- message queues

unless a concrete requirement appears.

### Security

The legacy diagnostic PIN pattern must not be migrated.

Production secrets must not be committed to Git.

Applications must not access the Podman socket.

Database access remains private to the application network.

Current sampled public data appears to contain aggregate facility/area data,
not patient-level or person-level fields.

A final public-data field review is still required before production cutover.

## Repository model

The existing Next.js frontend remains at repository root.

Backend v2 is added as a sibling package under `backend/`.

Initial npm workspaces, Turborepo, Nx, Lerna, and shared-package extraction are
not introduced.

Infrastructure source belongs under `infra/`.

Legacy Google Apps Script source under `src/scripts/` remains unchanged until
legacy retirement is separately authorized.

## Consequences

Benefits:

- explicit web/API/database trust boundaries
- private database
- independent backend testing and deployment
- preservation of config-driven KPI semantics
- transactional dataset activation
- controlled database recovery
- limited operational complexity

Trade-offs:

- two Node packages must be maintained
- web and API require independent images
- PostgreSQL becomes a new operational dependency
- migration requires temporary operation of both legacy and v2 systems

These trade-offs are accepted.

## Deferred decisions

The following are intentionally not frozen by this ADR:

- final public hostname
- exact OCI image digests
- final container resource limits
- exact raw-data retention period
- exact Prometheus metric set
- production database credentials

Each belongs to a later bounded implementation or deployment gate.
