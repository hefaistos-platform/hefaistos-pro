# Versions

This directory stores generated version documents for the platform.

A GitHub Actions workflow creates a new file here whenever a new tag matching `v*` is pushed.
Each generated file is named after the version tag (for example: `v1.2.3.md`) and contains:

- Changes
- Fixes
- Removals
