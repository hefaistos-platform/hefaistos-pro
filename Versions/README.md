# Versions

This directory stores generated platform version changelog documentation.

A new file is created for every platform version using the filename format:

- `<MAJOR>.<MINOR>.<PATCH>.md` (for example `1.5.2.md`)

Workflows that can generate these files:

- `.github/workflows/sharp-version.yml` on pushes to `sharp`
- `.github/workflows/version-changelog.yml` on release tags (`v*`)

Each file includes:

- Changes
- Fixes
- Removals
