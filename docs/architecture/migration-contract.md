# PA Dashboard Backend v2 Migration Contract

- Status: Active
- Date: 2026-09-11
- Legacy production baseline: `pa-legacy-production-2026-09-11`
- Legacy source SHA: `a5f6a3e320d6a5f42e6f1b7867b431959d0ce5a4`

## Purpose

This contract defines the migration boundary between the current PA Dashboard
production system and Backend v2.

It is intended to prevent accidental behavior drift, premature cutover, or
silent removal of legacy functionality.

## Legacy production remains authoritative during migration

Until explicit production cutover:

- `main` remains the legacy production line
- GitHub Pages remains active
- Google Apps Script remains active
- Google Sheets remains active

Backend v2 runs in parallel.

Legacy retirement is not implied by completion of backend development.

## Intended KPI target

Backend v2 targets:

- physical sources: 18
- virtual KPIs: 34
- total KPI contract: 52

The current legacy live payload contains:

- physical sources: 18
- virtual KPIs: 30
- total payloads: 48

The difference is known legacy configuration drift.

Missing live PCV virtual KPIs:

- `s_epi1__pcv1`
- `s_epi1__pcv2`
- `s_epi1__pcv3`
- `s_epi2__pcv4`

Backend v2 must not intentionally reproduce this omission.

## Calculation compatibility

Before optimization or redesign, Backend v2 must preserve the established
business semantics for:

- annual KPI calculation
- quarterly KPI calculation
- target-month behavior
- effective-quarter behavior
- virtual KPI derivation
- source-sheet mapping
- value-prefix mapping
- source-id filtering
- facility and area aggregation
- current fiscal-year and province settings

Compatibility must be demonstrated by tests.

## Config-driven behavior

KPI definitions must remain data/config-driven.

Adding or changing a KPI should not require duplicating application logic when
the existing metadata model can express the change.

## Synchronization safety

A failed or incomplete synchronization must not replace the active dataset.

Synchronization must record sufficient run information to determine:

- start
- completion
- success/failure
- source-level failures
- active dataset identity

Activation occurs only after run validation succeeds.

## Frontend migration

The existing frontend remains the compatibility reference during Backend v2
implementation.

Frontend migration to `/api/v1/*` requires its own explicit gate.

Frontend cutover is not authorized by this document.

## Public exposure

Only the web application is intended for public routing.

Backend API and PostgreSQL are private application services.

No new host firewall exposure is implied.

## Legacy security exception

The legacy diagnostic PIN mechanism exists in publicly visible legacy source.

It is classified as legacy-only behavior.

It must not be copied into Backend v2.

Its remediation or retirement requires a separate explicit action.

## Data classification

The sampled legacy public payload contained facility/area aggregate fields.

No patient-level or person-level identifier was observed during inventory.

This observation does not replace the final public-data review required before
Backend v2 production exposure.

## Backup and recovery

Database backup is logical (`pg_dump`).

A successful database restore test is mandatory before production cutover.

Changes to the platform Restic manifest require their own bounded gate,
including recovery evidence.

## Production cutover requirements

Production cutover is prohibited until all required migration gates pass,
including at minimum:

- database foundation
- MOPH synchronization
- read API
- frontend API migration
- Podman deployment
- public routing
- backup and recovery
- observability
- legacy/v2 parity verification
- final public-data review

## Retirement

Google Apps Script, Google Sheets, and legacy GitHub Pages deployment may be
retired only after explicit post-cutover authorization.

No migration implementation task may silently delete legacy production
components.
