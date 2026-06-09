# ATT&CK Framework Updates — UI-Driven Flow

This document describes the end-to-end workflow for updating the MITRE ATT&CK framework data used by the local ATT&CK Navigator embedded in the Coverage Map page.

---

## Architecture overview

```
Browser (iframe)
  └─> /navigator/           → nginx serves vendored Navigator SPA
  └─> /navigator/data/      → nginx aliases /navigator-data/data/  (dynamic STIX bundles)
  └─> /navigator/assets/config.json
                            → nginx aliases /navigator-data/config.json (dynamic config)

Backend container
  └─> /navigator-data/      (read-write Docker volume: navigator_data)

Nginx container
  └─> /navigator-data/      (read-only mount of the same volume)
```

The `navigator_data` named Docker volume is the shared store between the backend (writer) and nginx (reader). The backend populates it via `sync_navigator_data()` which is called as part of every `import_mitre_universal` run, whether from the CLI or through the new UI.

---

## UI-driven update workflow (new)

### Who can trigger an update

Only users with the **ADMIN** role can access the Framework Updates admin page.

### Steps

1. Navigate to **Framework Updates** in the admin sidebar (or go to `/mgmt/framework-updates`).
2. The page shows:
   - **Currently Loaded Frameworks** — the version and import date of each framework already in the DB (`enterprise-attack`, `ics-attack`, `mobile-attack`).
   - A **"A newer version is available: vX.Y"** banner when the latest release on GitHub (`https://api.github.com/repos/mitre-attack/attack-stix-data/tags`) is higher than what's loaded.
3. Fill in the **version** field (pre-filled with the latest available), choose **Remote** or **Local** mode, and click **Run Update**.
4. The mutation `RunMitreImport(version, mode)` creates a `MitreImportJob` record and starts a background job.
5. The page polls `mitreImportJob(id)` every 3 seconds, showing live status (`PENDING → RUNNING → SUCCESS / FAILED`).
6. On `SUCCESS` a toast notification appears. Click **↗ Reload Coverage Map** to navigate back to the Coverage Map with a `frameworkUpdated` flag that causes the Navigator iframe to reload, picking up the new STIX bundles.

### What happens in the background

The background thread (started by `run_mitre_import_job` in `backend/platform_data/tasks.py`) does the following:

1. Marks the `MitreImportJob` as `RUNNING` and records `started_at`.
2. Calls `import_mitre_universal` via Django's `call_command`, redirecting stdout/stderr into a `StringIO` buffer so the log is captured in `job.log`.
3. The management command:
   a. Imports techniques, strategies, analytics, and ATT&CK objects into the database.
   b. Calls `sync_navigator_data(version, mode, ...)` which:
      - Downloads STIX bundles for each domain (`enterprise-attack`, `ics-attack`, `mobile-attack`) into `/navigator-data/data/v<version>/`.
      - Scans **all existing** `v<X.Y>` subdirectories and builds a cumulative `data/index.json` so previous versions remain selectable in the Navigator.
      - Writes `config.json` with `versions.enabled: true` and one entry per domain per version.
4. Marks the job `SUCCESS` (or `FAILED` with error details) and records `finished_at`.

---

## Multi-version Navigator support

The `_build_collection_index` and `_build_config` functions in `backend/platform_data/navigator_sync.py` scan the entire `data/` directory for `v<X.Y>` subdirectories. This means:

- Importing v19.1 will include v19.1 bundles in the index/config.
- Importing v20.0 later will include **both** v19.1 and v20.0 in the index/config.
- The Navigator's version selector will show all imported versions, and users can compare across them.
- Old STIX files on disk are never deleted; only the index and config are regenerated.

---

## CLI flow (still supported)

The original CLI workflow continues to work unchanged:

```bash
# Remote update (downloads from MITRE GitHub)
docker compose exec backend python manage.py import_mitre_universal \
  --mitre-version 20.0 --mode remote

# Local/air-gapped update (uses pre-staged files)
docker compose exec backend python manage.py import_mitre_universal \
  --mitre-version 20.0 --mode local --dir /app/data/mitre
```

Both CLI and UI paths call the same underlying `sync_navigator_data()` function, so they produce identical results.

---

## GraphQL API reference

### Queries

| Field | Description |
|---|---|
| `loadedAttackVersions` | Returns `[PlatformDataVersionType]` — currently loaded version per framework. |
| `latestAvailableAttackVersion` | Returns `String` — highest semver tag from GitHub ATT&CK STIX repo (cached 1 hour, returns `null` on network error). |
| `mitreImportJobs(limit: Int)` | Returns the latest import jobs ordered by `-created_at`. |
| `mitreImportJob(id: UUID!)` | Returns a single job by ID (used for polling). |

### Mutations

| Field | Description |
|---|---|
| `runMitreImport(version: String!, mode: String)` | Admin-only. Creates a `MitreImportJob` and starts the background import. Returns `{ job { id, version, mode, status, createdAt } }`. |

---

## Database model: `MitreImportJob`

| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Job identifier |
| `version` | string | ATT&CK version (e.g. `19.1`) |
| `mode` | REMOTE \| LOCAL | Import source |
| `status` | PENDING \| RUNNING \| SUCCESS \| FAILED | Current state |
| `log` | TextField | Captured stdout/stderr from the import command |
| `error` | TextField | Error message / traceback on failure |
| `created_at` | datetime | When the job was created |
| `started_at` | datetime (null) | When execution started |
| `finished_at` | datetime (null) | When execution completed |
| `triggered_by` | FK → User (null) | The admin user who triggered the job |

---

## Coverage Map changes

- The Coverage Map header now shows **ATT&CK: vX.Y (loaded YYYY-MM-DD)** for the `enterprise-attack` framework.
- Admins see an **"Update framework"** link that navigates to `/mgmt/framework-updates`.
- When returning from the Framework Updates page after a successful import (via the "Reload Coverage Map" button), the Navigator iframe automatically reloads to pick up the new STIX bundles.

### Coverage Map coloring rules

- `PlaybookGraph` (Workbench) with status `DEPLOYED` is the primary coverage signal.
- `DetectionRule` records with `status == "deployed"` also contribute ATT&CK IDs extracted from `title`, `description`, and `raw_content`.
- Parent techniques use a light yellow → orange → green scale based on covered sub-technique fraction, while directly covered sub-techniques are rendered green.
