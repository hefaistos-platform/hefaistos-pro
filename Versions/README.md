# Versions

This directory stores generated platform version changelog documentation.

A GitHub Actions workflow (`.github/workflows/version-changelog.yml`) updates `changelog.md` whenever a release tag (matching `v*`) is created.
The changelog contains one section per version tag and each section includes:

- Changes
- Fixes
- Removals
