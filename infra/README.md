# PA Dashboard Deployment Foundation (repo-only)

This directory contains the **deployment artifacts** for the PA Dashboard
production runtime: OCI image recipes, Quadlet source templates, a
digest-pinned renderer, and deployment contract tests.

It produces deployable artifacts. It does **not** install, start, or expose
anything. All host-side installation is a separate, explicitly authorized
gate.

## Architecture boundary

| Aspect | Owner |
| --- | --- |
| Production runtime | `websvc` (system user) |
| Development | `thanakorn` |

Production architecture:

- rootless Podman + user systemd (Quadlet), SELinux Enforcing
- immutable OCI application images (digest-pinned at install time)
- **no Git worktree at runtime** — containers run only from OCI images, never
  from a checkout of this repository
- PostgreSQL 18 with persistent named volume
- private API and private database (no host ports)
- same-origin browser API: the web frontend proxies `/api/v1/*` to the API
  container via a Next.js rewrite (`pa-dashboard-api:3001` is frozen
  deployment topology, not host configuration)

## Platform boundary — `edge` is external

The existing platform owned by `websvc` already provides: the `edge` Podman
network, the `observability` network, Traefik, Cloudflared, Prometheus and
Grafana. These are **external platform assets**. This repository does not
recreate, modify, or attach to them.

This foundation does **NOT** establish public routing. `pa-dashboard-web`
joins only the private `pa-dashboard-app` network. Connecting the web tier to
`edge` (and therefore public ingress) is a separate future gate.

## Generated Quadlet bundle

Everything under `infra/quadlet/` is source material:

- `*.container.in` — container unit **templates** with image placeholders
  (`@@PA_WEB_IMAGE@@`, `@@PA_API_IMAGE@@`, `@@PA_DB_IMAGE@@`); they are not
  directly installable
- `*.network`, `*.volume` — static definitions copied verbatim

`infra/render-quadlets.mjs` renders a complete, installable bundle:

```sh
node infra/render-quadlets.mjs \
  --web-image registry.example/pa-dashboard-web@sha256:<64-hex> \
  --api-image registry.example/pa-dashboard-api@sha256:<64-hex> \
  --db-image  docker.io/library/postgres@sha256:<64-hex> \
  --output /tmp/pa-dashboard-quadlets
```

Rules enforced by the renderer:

- every `--*-image` must be an immutable reference ending in
  `@sha256:` + 64 lowercase hex characters — tags (`:latest`, version tags),
  malformed digests, and unresolved placeholders are rejected
- the renderer never writes to `~/.config/containers/systemd`, never calls
  `systemctl` or `podman`, and deploys nothing

Generated Quadlets require **digest-pinned images** because Quadlet units are
declarative: a tag could silently drift under a "working" unit, while a digest
guarantees the exact bytes that were reviewed. Resolve the digest once per
release (e.g. `podman image inspect --format '{{.Digest}}' <ref>`), render,
review the diff, then install.

Future install location (separate gate, performed by/with `websvc`):

```
%h/.config/containers/systemd/
```

A safe pre-install validation of a rendered bundle is the systemd generator
dry run:

```sh
QUADLET_UNIT_DIRS=/tmp/pa-dashboard-quadlets \
  /usr/lib/systemd/system-generators/podman-system-generator --user --dryrun
```

## Host configuration files (created on the host, never committed)

The units read environment files from the `websvc` user's home. Only these
paths are expected:

| File | Required variable names | Purpose |
| --- | --- | --- |
| `%h/.config/pa-dashboard/postgres.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL image initialization (read once at first volume init) |
| `%h/.config/pa-dashboard/database.env` | `DATABASE_URL` | Application connection string used by API, migration, reference and sync units |
| `%h/.config/pa-dashboard/reference.env` | `PA_REFERENCE_SOURCE_URL` | Reference source for hospital/tambon population |

Notes:

- No credential values belong in this repository; the files above are host
  secrets owned by `websvc`.
- Synchronization needs no separate MOPH credential file: the current MOPH
  transport uses the existing public endpoint and config stored in the
  database.

## Operational roles of the units

| Unit | Kind | Role |
| --- | --- | --- |
| `pa-dashboard-db.service` | long-running | PostgreSQL 18 on the private network, health-gated (`pg_isready`), no host port |
| `pa-dashboard-migrate.service` | oneshot, `RemainAfterExit=yes` | Applies checksum-protected SQL migrations from the API image; boot dependency ordered after a healthy database |
| `pa-dashboard-api.service` | long-running | Backend-v2 API (`0.0.0.0:3001`, container-only), readiness via `/api/v1/health/ready`, ordered after successful migration |
| `pa-dashboard-web.service` | long-running | Next.js standalone server (`0.0.0.0:3000`, container-only), ordered after a healthy API |
| `pa-dashboard-reference.service` | oneshot, manual | Populates hospital/tambon reference data; no auto-start, re-runnable |
| `pa-dashboard-sync.service` | oneshot, manual | One MOPH synchronization pass; no auto-start, re-runnable, timer-ready but **no timer exists yet** |

### PostgreSQL 18 volume location

The official PostgreSQL 18 image declares `PGDATA=/var/lib/postgresql/18/docker`.
The named volume `pa-dashboard-db-data` is therefore mounted at exactly
`/var/lib/postgresql` — **not** `/var/lib/postgresql/data`. Mounting at
`.../data` would place the volume above the image's own PGDATA layout and
break initialization. Do not override `PGDATA`.

### Port policy

- API: no `PublishPort` — reachable only inside `pa-dashboard-app`
- DB: no `PublishPort` — 5432 is never exposed on the host
- Web: no `PublishPort` — public routing is deferred (see above)

## OCI images

- `infra/containers/web.Containerfile` — Node 24 multi-stage build; runtime
  contains only the Next.js standalone server, `.next/static` and `public`;
  non-root, port 3000
- `infra/containers/api.Containerfile` — Node 24 multi-stage build; runtime
  contains production dependencies, compiled `dist/` and `migrations/`;
  non-root; the same image serves API, migration, reference and sync commands

Neither image contains credentials. Base images are referenced by tag for
builds; the application images are digest-pinned at host-deployment time.

## OCI release

`.github/workflows/oci-release.yml` is the release machinery for the two
application images. It exists as a repository workflow only: nothing has been
published through it yet, and the GHCR packages are not created until the
first tagged release actually runs.

Canonical image names (`linux/amd64` only):

- `ghcr.io/9gotstory/pa-dashboard-web`
- `ghcr.io/9gotstory/pa-dashboard-api`

Release contract:

- Publishing is gated on an explicit Git tag
  `oci-<first 12 chars of the canonical 40-char commit SHA>`, pushed as a
  lightweight tag carrying the commit SHA (an annotated tag object would not
  match `GITHUB_SHA` and fails closed).
- The published image tag is `sha-<full 40-char commit SHA>`. There is no
  `latest` tag and no branch, pull-request, scheduled or manual-dispatch
  publishing.
- Before registry login or any push, the workflow fails closed unless the
  tag name, `GITHUB_SHA` and the freshly fetched `origin/develop` tip all
  resolve to the same commit: the tagged SHA must equal the current
  `origin/develop` at publish time.
- Production consumes immutable `@sha256:` digest references, never tags.

Authentication: the workflow uses only the automatic GitHub Actions
`GITHUB_TOKEN` with `contents: read` and `packages: write`. No personal
access token (PAT) secret is configured or required.

Release ≠ deployment:

- Publishing the two packages is not atomic. The follow-up **OCI RELEASE
  VERIFY** gate must confirm **both** image digests resolve from the same
  source SHA before either image may be authorized for deployment.
- Initial GHCR package visibility must be verified after the first
  publication; package existence/visibility verification is a separate gate,
  not part of the workflow.
- The production `websvc` user is **not** logged into GHCR by this gate, and
  host installation/deployment remains a separate gate.
- If the packages turn out to be private, do not silently add registry
  credentials; stop for an explicit visibility/auth decision first.

## Verification

From the repository root:

```sh
node --test infra/test/deployment-contract.test.mjs
```

## Explicitly out of scope (separate gates)

- backup/restore
- public routing / `edge` attachment
- synchronization timer cadence
- production cutover

Legacy GitHub Pages / GAS / Sheets production on `main` remains untouched and
is not retired by anything in this directory.
