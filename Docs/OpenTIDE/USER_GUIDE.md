# OpenTIDE User Guide

## Overview
HEFAISTOS publishes OpenTIDE content through **OpenTIDE HEF** only.

Use this flow when you want to:
- preview AI-enriched OpenTIDE metadata,
- push the resulting bundle to GitHub,
- optionally deploy to selected SIEM platforms from HEFAISTOS.

## Before you start
Ask your administrator to configure:
1. a GitHub-backed rule repository,
2. an OpenTIDE HEF publish profile in **Configuration → OpenTIDE HEF**,
3. any platform credentials required for direct deployment.

## Workbench publish flow
1. Open a workbench.
2. Generate an OpenTIDE preview.
3. Review MDR/DOM output and validation results.
4. Click **Continue to HEF Publish**.
5. In the HEF publish dialog, choose a publish profile or repository.
6. Optionally select deployment targets.
7. Click **Publish**.

## Preview behavior
The preview modal still uses the shared async preview workflow:
- `startOpentidePreviewTask`
- `opentidePreviewStatus`
- `latestOpentidePreview`
- `previewOpentideMetadata`

This preview is used by the HEF publish flow.

## Where to configure publishing
- **Configuration → OpenTIDE HEF**: publish profiles
- **Configuration → Rules**: repositories
- **Configuration → Platform Credentials**: direct deployment credentials

## Troubleshooting
### No publish profiles available
Create one in **Configuration → OpenTIDE HEF**.

### Publish failed before deployment started
Verify the selected GitHub repository, branch, and PAT-backed repository access.

### Platform deployment was skipped or failed
Check that the selected platform credentials are configured and enabled.


---

## Importing Workbenches from OpenTIDE HEF (GitHub)

Analysts with ANALYST or ADMIN role can recreate Workbenches from HEF bundles
previously published to GitHub. This is useful for disaster recovery,
point-in-time restore, and cross-environment promotion.

### How to import

1. Open the **Workbench Hub** (`/playbooks`).
2. Click **Import Workbench ▾** → **From OpenTIDE HEF (GitHub)**.
3. Pick a **HEF Publish Profile** (or enter repo details manually).
4. Optionally enter a commit SHA to restore from a specific point in time.
5. Browse bundles → select one or many → configure naming and conflict handling.
6. Click **Start Import** and monitor the per-bundle progress.

For a complete walkthrough, including disaster-recovery steps, see [HEF_IMPORT_GUIDE.md](HEF_IMPORT_GUIDE.md).
