# OpenTIDE HEF Import Guide

## Overview

The **OpenTIDE HEF Import** feature is the inverse of the HEF Publish flow.
It lets you recreate one or many Workbenches from OpenTIDE HEF bundles
previously published to a GitHub repository.

### Use cases

| Scenario | Description |
|----------|-------------|
| **Disaster recovery** | HEFAISTOS data is lost or corrupted — restore Workbenches from the last published HEF commit. |
| **Point-in-time restore** | Pin to a specific commit SHA to recreate Workbenches exactly as they were on a given date. |
| **Cross-environment promotion** | Pull HEF bundles published from PROD into a STAGING instance. |
| **Bulk onboarding** | Onboard a new HEFAISTOS instance from an existing GitHub rule library in minutes. |

---

## Prerequisites

- A GitHub repository that already contains OpenTIDE HEF bundles (i.e., folders
  containing at least `mdr.yaml`, previously published by the HEF Publish flow).
- A **HEF Publish Profile** configured in **Settings → OpenTIDE → HEF Profiles**
  (recommended), or the repository's owner/name and a configured **Rule Repository**
  entry with a GitHub PAT.
- Your user role must be **ANALYST** or **ADMIN**.

---

## How to import

1. Open the **Workbench Hub** (`/playbooks`).
2. Click **Import Workbench ▾** (dropdown button next to **+ New Workbench**).
3. Select **From OpenTIDE HEF (GitHub)**.
4. The **Import from HEF** wizard opens (5 steps):

### Step 1 — Source

Choose how to identify the repository:

- **Use an existing HEF Publish Profile** (recommended) — HEFAISTOS automatically
  fills in repo URL, branch, target folder, and PAT from the saved profile.
- **Specify repository manually** — enter GitHub owner, repository name, branch,
  and optionally a target folder (e.g. `detection-rules/`).

**Commit SHA (optional):** Leave blank to use the latest commit, or enter a full
or abbreviated commit SHA to restore a specific point in time.

Click **Load Bundles** to proceed.

### Step 2 — Browse & select bundles

HEFAISTOS scans the repository and lists all discovered HEF bundles (folders
containing `mdr.yaml`):

| Column | Description |
|--------|-------------|
| **Bundle path** | Path to the `mdr.yaml` file in the repository |
| **MDR title** | `metadata.title` from `mdr.yaml` |
| **Status** | `metadata.status` (e.g. `experimental`, `production`) |
| **Techniques** | MITRE ATT&CK technique IDs from `tvm.yaml` |
| **Validation** | ✓ / ✗ — whether the bundle passed OpenTIDE schema validation |

Use the **search** box and **technique/status filters** to narrow the list.
Tick one or more bundles, then click **Next**.

> **Fast-path discovery:** If the repository was published with HEFAISTOS v5.0+,
> a `_hef_index.json` manifest exists at the root of the target folder. HEFAISTOS
> uses it to list bundles in a single API call instead of walking the full tree.
> Older repositories without the manifest fall back to a recursive tree walk automatically.

### Step 3 — Naming & conflict handling

For each selected bundle, you can edit the **Workbench name** (defaults to
`metadata.title` from `mdr.yaml`).

Global options:

| Option | Default | Description |
|--------|---------|-------------|
| **On conflict** | Create new copy | What to do if a Workbench with the same MDR UUID already exists |
| **Also import per-platform rule files** | On | Import `kql/`, `splunk/`, `wazuh/`, `qradar/`, `sigma/` files as linked DetectionRule objects |
| **Dry-run** | Off | Validate everything and report what would happen — no Workbenches are created |

**Conflict modes:**

| Mode | Behaviour |
|------|-----------|
| `Create new copy` | Always create a new Workbench; adds `(restored YYYY-MM-DD)` suffix if UUID clash |
| `Overwrite existing by MDR UUID` | If a Workbench with matching MDR UUID exists, update it in place |
| `Skip` | If a Workbench with matching MDR UUID exists, skip this bundle entirely |

### Step 4 — Confirm & queue

Review the summary and click **Start Import** (or **Start Dry-run**).

A background job is created and queued. You can close the dialog immediately —
the import continues in the background.

### Step 5 — Progress

The wizard shows live job status:

```
QUEUED → PROCESSING → COMPLETED / FAILED
```

For each bundle, the result table shows:

| Column | Values |
|--------|--------|
| **Status** | `CREATED`, `UPDATED`, `SKIPPED`, `FAILED`, `DRY_RUN_OK` |
| **Workbench** | Link icon — click to open the new Workbench |
| **Errors** | First error message if the bundle failed |

---

## Disaster recovery walkthrough

Assume HEFAISTOS database was wiped. You have a GitHub repository
`my-org/detection-rules` with bundles previously published under `hefaistos/`.

```bash
# 1. Spin up a fresh HEFAISTOS instance
docker compose up -d

# 2. Apply migrations
docker compose exec backend python manage.py migrate

# 3. Start the import worker
docker compose up -d opentide-hef-import-worker

# 4. In the UI: re-create your HEF Publish Profile
#    Settings → OpenTIDE → HEF Profiles → Add Profile
#    (same repo URL, branch, target folder, PAT as before)

# 5. Open Workbench Hub → Import Workbench ▾ → From OpenTIDE HEF (GitHub)
#    Select the profile → Load Bundles → Select All → Conflict: Create new copy
#    → Start Import

# 6. Confirm all Workbenches appear on the Hub with correct MDR UUIDs
```

For a point-in-time restore, enter the commit SHA in Step 1 before loading bundles.

---

## Post-pull commands

After pulling this version of HEFAISTOS from git:

```bash
# 1. Rebuild backend image (new worker, new migrations)
docker compose build backend opentide-hef-import-worker

# 2. Apply Django migrations
docker compose exec backend python manage.py migrate

# 3. Start the new import worker
docker compose up -d opentide-hef-import-worker

# 4. Verify it is consuming the queue
docker compose logs -f opentide-hef-import-worker
# Expected: "Listening on opentide.hef.import.queued"

# 5. Rebuild frontend (new ImportFromHefModal + GraphQL ops)
docker compose build frontend
docker compose up -d frontend

# (Optional) Run new tests
docker compose exec backend python manage.py test playbooks.tests.test_hef_import
```

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `backend/playbooks/hef_import.py` | Discovery, fetch, validate, bundle→HEX v2.0 conversion |
| `backend/playbooks/hef_import_worker.py` | RabbitMQ consumer, orchestrates the import job |
| `backend/playbooks/management/commands/run_opentide_hef_import_worker.py` | Django management command |
| `backend/playbooks/tests/test_hef_import.py` | Unit tests |
| `frontend/src/graphql/hefImport.ts` | GraphQL operations |
| `frontend/src/components/playbook/ImportFromHefModal.tsx` | 5-step wizard UI |

### New model: `OpenTideHefImportJob`

Located in `organizations.models`. Mirrors `OpenTideHefPublishJob`. Fields:

- `status` — `QUEUED / PROCESSING / COMPLETED / FAILED`
- `profile` — FK to `OpenTidePublishProfile` (nullable)
- `repo_owner`, `repo_name`, `branch`, `target_folder`
- `source_commit_sha` — pinned SHA (blank = latest)
- `selected_bundles` — JSON list of bundle paths
- `conflict_mode` — `NEW_COPY / OVERWRITE / SKIP`
- `import_platform_rules` — boolean
- `dry_run` — boolean
- `results` — JSON list of per-bundle results
- `error_message` — top-level error text

### Provenance fields on `PlaybookGraph`

New optional fields that record where an imported Workbench came from:

- `imported_from_repo` — `owner/repo`
- `imported_from_commit_sha` — full commit SHA
- `imported_from_path` — path to `mdr.yaml` in repo
- `imported_at` — timestamp
- `imported_by` — FK to `CustomUser`

### New GraphQL operations

| Operation | Type | Description |
|-----------|------|-------------|
| `listHefBundles` | Query | List bundle descriptors in a repo |
| `queueOpentideHefImport` | Mutation | Enqueue an import job |
| `myOpentideHefImportJobs` | Query | List current user's recent import jobs |

All gated with `@role_required([Roles.ANALYST, Roles.ADMIN])`.

### RabbitMQ routing

- **Routing key in:** `opentide.hef.import.queued`
- **Queue:** `opentide.hef.import.jobs`
- Exchange: same topic exchange as publish worker (`hefaistos`)

### `_hef_index.json` manifest

When the HEF Publish worker completes a successful publish, it now writes
(or updates) `<target_folder>/_hef_index.json` with a JSON array:

```json
[
  {
    "path": "detection-rules/Objects/Detection Rules/test.yaml",
    "mdr_uuid": "12345678-1234-5678-1234-567812345678",
    "title": "Test Detection Rule",
    "status": "experimental",
    "last_commit_sha": "a1b2c3d4...",
    "exported_at": "2024-06-01T12:00:00Z"
  }
]
```

The importer uses this file as a fast-path to enumerate bundles in O(1) API
calls instead of O(n) tree-walk calls. Repos without the manifest (published
before this version) continue to work via automatic tree-walk fallback.

---

## Idempotency & safety

- **Idempotency key:** `(profile_id, commit_sha, bundle_path)` — if a
  Workbench was already imported with the same key, the job skips it (unless
  `conflict_mode = OVERWRITE`).
- **Hard cap:** 100 bundles per job (configurable via
  `HEF_IMPORT_MAX_BUNDLES_PER_JOB` Django setting).
- **Validation-first:** invalid bundles are reported and skipped; they never
  crash the whole job.
- **ActivityLog:** an `OPENTIDE_HEF_IMPORT` audit entry is written per
  Workbench created, symmetric to publish entries.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No HEF bundles found" | Wrong target folder, or repo has no `mdr.yaml` files | Verify `target_folder` matches what was used when publishing |
| "GitHub token not found" | No PAT configured | Add a PAT to the Rule Repository or HEF Publish Profile in Settings |
| Import job stuck in PROCESSING | Worker not running | Run `docker compose up -d opentide-hef-import-worker` |
| MDR UUID collision | Bundle already imported | Change conflict mode to `Overwrite` or `Skip`, or use `Dry-run` first |
| Partial failure | Some bundles have validation errors | Check per-bundle errors in the Progress step; fix YAML and re-import |
