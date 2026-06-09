# OpenTIDE HEF Administrator Setup Guide

## Overview
The supported administrative path is now **OpenTIDE HEF**.

HEFAISTOS no longer requires an SSH deploy key or legacy InitTide configuration.

## Required setup
### 1. Configure a GitHub repository
Go to **Configuration → Rules** and create or update a repository entry that points to the target GitHub repository.

Requirements:
- repository URL
- branch
- GitHub PAT with permission to create commits

### 2. Configure OpenTIDE HEF publish targets
Go to **Configuration → OpenTIDE HEF** and create a publish profile.

Typical profile fields:
- repository
- branch
- target folder
- whether to push per-platform rule files
- default enabled platforms

### 3. Configure platform credentials (optional)
If you want HEFAISTOS to deploy directly after publishing, configure the needed platform credentials in **Configuration → Platform Credentials**.

## Operational flow
1. Analyst generates an OpenTIDE preview from the Workbench.
2. Analyst continues to HEF publish.
3. HEFAISTOS validates and compiles the OpenTIDE bundle.
4. HEFAISTOS pushes the bundle to GitHub.
5. HEFAISTOS optionally deploys to selected platforms.

## Removed legacy setup
Do not configure:
- SSH deploy keys for InitTide
- legacy InitTide repository settings
- `opentide-commit-worker`
- `commitPlaybookToInitTide`

## Validation checklist
- Repository entry works with GitHub PAT access.
- At least one HEF publish profile exists.
- Optional platform credentials test successfully.
- Users can reach **Configuration → OpenTIDE HEF**.


---

## HEF Import worker setup

The HEF Import feature requires a new background worker service.

### docker-compose.yml (automatic)

The `opentide-hef-import-worker` service is already defined in `docker-compose.yml`.
Start it with:

```bash
docker compose up -d opentide-hef-import-worker
```

### Migrations

After pulling and rebuilding, apply the new Django migrations:

```bash
docker compose exec backend python manage.py migrate
```

New migrations add:
- `OpenTideHefImportJob` model (in `organizations` app)
- Import provenance fields on `PlaybookGraph` (in `playbooks` app)

### Settings

Configure the maximum bundles per import job (default: 100):

```python
# backend/core/settings.py (or environment override)
HEF_IMPORT_MAX_BUNDLES_PER_JOB = 100
```

### Permissions

Import operations require the **ANALYST** or **ADMIN** role — the same as
publishing. No additional role configuration is needed.

See [HEF_IMPORT_GUIDE.md](HEF_IMPORT_GUIDE.md) for the full user-facing import walkthrough.
