# OpenTIDE Developer API Reference

## Supported backend concepts
### Preview
Shared preview APIs remain available and are used by the HEF publish flow:
- `previewOpentideMetadata`
- `startOpentidePreviewTask`
- `opentidePreviewStatus`
- `latestOpentidePreview`

### Publish
Supported HEF publish objects:
- `OpenTidePublishProfile`
- `OpenTideHefPublishJob`
- `publishWorkbenchOpenTide`
- `pushPlaybookToGithub`

### Configuration
Supported admin APIs:
- `setOpenTidePublishProfile`
- `deleteOpenTidePublishProfile`
- `platformCredentials`
- `setPlatformCredential`
- `deletePlatformCredential`
- `testPlatformConnection`

## Removed legacy surface
These legacy SSH-based objects and mutations are no longer part of the product:
- `InitTideConfiguration`
- `OpenTideCommitJob`
- `PlaybookCommitHistory`
- `ConfigureInitTide`
- `TestInitTideConnection`
- `commitPlaybookToInitTide`
- `commitJobStatus`

## Frontend GraphQL usage
Workbench and HEF UI now rely on:
- preview queries/mutations from `frontend/src/graphql/opentide.ts`
- `publishWorkbenchOpenTide` for HEF publish jobs

## Notes
- HEF is GitHub-first and PAT-based.
- Direct deployment is optional and depends on selected platforms plus configured credentials.
- The legacy SSH worker and GraphQL flow were intentionally removed.
