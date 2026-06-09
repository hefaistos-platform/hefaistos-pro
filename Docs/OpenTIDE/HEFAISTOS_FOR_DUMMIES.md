# OpenTIDE HEFAISTOS for Dummies

## The simple version
HEFAISTOS now has one OpenTIDE publishing path:

**Workbench → Preview → OpenTIDE HEF → GitHub → optional platform deployment**

## What this means
- You still design detections in the Workbench.
- HEFAISTOS still shows OpenTIDE previews.
- Publishing now goes through GitHub using a PAT-backed repository configuration.
- HEFAISTOS can optionally deploy directly to supported platforms.

## Where admins set it up
- **Configuration → Rules** for repositories
- **Configuration → OpenTIDE HEF** for publish profiles
- **Configuration → Platform Credentials** for direct deployment

## What changed
The old InitTide SSH flow is gone. There is no separate InitTide admin page anymore.

## Import from GitHub (new in v5.0)

Need to restore Workbenches after a disaster? Want to promote detections from PROD to STAGING?

**Workbench Hub → Import Workbench ▾ → From OpenTIDE HEF (GitHub)**

1. Pick the GitHub repository where your detections were published.
2. Choose which bundles (detections) to import.
3. Click **Start Import** — HEFAISTOS re-creates the Workbenches for you.

You can also pick a specific **commit SHA** to go back in time.

See [HEF_IMPORT_GUIDE.md](HEF_IMPORT_GUIDE.md) for the full walkthrough.
