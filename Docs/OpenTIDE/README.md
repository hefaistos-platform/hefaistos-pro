# OpenTIDE in HEFAISTOS

HEFAISTOS now supports a single OpenTIDE integration path: **OpenTIDE HEF**.

## What stays
- OpenTIDE metadata preview in the Workbench
- GitHub-first publishing using a configured repository and GitHub PAT
- Optional direct deployment to supported platforms from HEFAISTOS
- Configuration via **Configuration → OpenTIDE HEF**

## What was removed
- Legacy InitTide / SSH push configuration
- Background SSH commit worker
- `commitPlaybookToInitTide` flow

## Related guides
| Guide | Audience | Purpose |
| --- | --- | --- |
| [USER_GUIDE.md](USER_GUIDE.md) | Analysts | Generate previews and publish from the Workbench |
| [ADMIN_SETUP_GUIDE.md](ADMIN_SETUP_GUIDE.md) | Admins | Configure repositories, PAT access, and publish profiles |
| [DEVELOPER_API_REFERENCE.md](DEVELOPER_API_REFERENCE.md) | Developers | GraphQL and backend objects for preview and HEF publish |
| [HEFAISTOS_FOR_DUMMIES.md](HEFAISTOS_FOR_DUMMIES.md) | New users | High-level explanation of the GitHub-first flow |
| [HEF_IMPORT_GUIDE.md](HEF_IMPORT_GUIDE.md) | Analysts / Admins | Disaster recovery, point-in-time restore, cross-environment import from HEF bundles |

## Publishing flow
1. Build or edit a workbench.
2. Generate an OpenTIDE preview.
3. Continue to **OpenTIDE HEF** publish.
4. Select a publish profile or GitHub repository.
5. HEFAISTOS commits the bundle to GitHub and optionally deploys to configured platforms.

## Import flow (disaster recovery / cross-environment)
1. Open the **Workbench Hub** (`/playbooks`).
2. Click **Import Workbench ▾ → From OpenTIDE HEF (GitHub)**.
3. Select a HEF Publish Profile or enter repository details manually.
4. Browse and select bundles, configure conflict handling, and start the import.
5. Monitor per-bundle results in the Progress step.

See [HEF_IMPORT_GUIDE.md](HEF_IMPORT_GUIDE.md) for the full walkthrough including disaster-recovery steps.

