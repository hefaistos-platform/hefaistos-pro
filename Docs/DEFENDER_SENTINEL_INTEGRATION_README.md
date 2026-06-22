# Defender/Sentinel First Integration README

This document summarizes the implemented changes for Microsoft Defender for Endpoint and Microsoft Sentinel first-class support, plus deeper HEFAISTOS/OpenTIDE integration and stabilization work.

## Scope

The implementation goal was:

- Make Defender/Sentinel the primary supported deployment technologies.
- Preserve backward compatibility for existing HEFAISTOS workflows.
- Improve deployment reliability and troubleshooting quality.
- Expose actionable operator diagnostics for failed deployments.

## Completed Phases

### Phase 1: Platform Credential Profiles (Backend + GraphQL)

Implemented multi-profile credentials per platform (for example, multiple Defender or Sentinel credential sets per organization):

- `PlatformCredential` now supports:
  - `profile_name` (default: `default`)
  - `is_default`
- Added preferred credential resolution helpers:
  - `get_preferred_for_platform(...)`
  - `preferred_credentials_map(...)`
- Updated GraphQL mutations to support profile-aware operations:
  - set credential with `profile_name` and `set_default`
  - delete credential by optional `profile_name`
  - test connection by optional `profile_name`

Compatibility behavior:

- Existing credential usage still works with profile `default`.
- Existing calls without profile parameters continue to function.

### Phase 2: KQL Target Policy Normalization

Added policy-based KQL mapping so `kql` can be directed to Defender, Sentinel, or both:

- New policy options:
  - `defender`
  - `sentinel`
  - `both`
- Introduced normalization behavior in publish flow.
- Added policy support to HEF publish mutation.

UI integration:

- Export/Import publish modal now supports selecting KQL target policy and sends it to backend.
- HEF publish profile now persists `kql_target_policy`.

### Phase 3: Sentinel as First-Class MDR Configuration

Expanded MDR model to treat Sentinel as first-class for KQL rules:

- Added `configurations.microsoft_sentinel` to MDR schema.
- Compiler emits both:
  - `configurations.defender_for_endpoint`
  - `configurations.microsoft_sentinel`
- Import/parsing paths detect and map Sentinel KQL config.
- Duplicate KQL format handling prevents duplicate rule creation where both blocks exist.

### Phase 4: Sentinel Deployer Parity and Hardening

Sentinel deployer now consumes actual MDR Sentinel config instead of static defaults:

- Uses config values like:
  - `queryFrequency`
  - `queryPeriod`
  - `triggerOperator`
  - `triggerThreshold`
  - `suppressionDuration`
  - `suppressionEnabled`
  - optional advanced blocks (`entityMappings`, `customDetails`, etc.)

Added stronger preflight validation:

- ISO-8601 duration checks
- operator enum checks
- integer/boolean checks
- structural checks for advanced nested blocks

Error handling improvements:

- Correct platform labeling for Sentinel failures.
- Improved ARM/Graph-style error parsing and detail surfacing.

### Phase 5: Defender Graph Deep Integration

Improved Defender deploy behavior to use richer MDR semantics:

- MDR-to-deployer payload now preserves `configurations.defender_for_endpoint`.
- Defender deployer now honors `defender_for_endpoint.alert` fields:
  - title
  - description
  - severity
  - enabled
- `impacted_entities` is used for better Graph impacted-asset mapping.
- Existing query-based fallback inference remains for compatibility.

### Phase 6: Deployment Failure Taxonomy and Stabilization

Added structured failure classification and summaries:

- Per-platform failed deployment results now include:
  - `failure_type`
  - `probable_cause`
  - `operator_hint`
- Added `build_deployment_failure_summary(...)` helper:
  - `failed_count`
  - `failed_platforms`
  - `failure_type_counts`
  - `operator_hints`

Worker/event integration:

- HEF publish worker includes `failure_summary` in failed event payloads.
- DaC deploy-only failure messages now include failure type rollups.

### Phase 7: Persisted HEF Job Failure Summary (Final Stabilization)

Added persistent job-level structured diagnostics:

- `OpenTideHefPublishJob.failure_summary` JSON field added.
- Populated by HEF worker for:
  - platform deployment failures
  - MDR validation failures
  - payload contract failures
  - unexpected runtime exceptions
  - status timeout conversion path
- Exposed through GraphQL job status.
- UI consumes and renders summary-level failure type counts.

## Frontend Enhancements Completed

- HEF Publish modal:
  - KQL target policy selector
  - enriched failed platform diagnostics display
  - failure type summary rendering (from `failureSummary`)
- Platform credentials settings:
  - profile-aware credential workflows for create/test/delete/default
- HEF publish target settings:
  - persistent `kqlTargetPolicy` per profile

## Test Coverage Added/Updated

Updated or added tests across:

- Sentinel deployer validation and payload usage.
- Error surface parsing (including ARM-style `error.details`).
- MDR-to-deployer payload mapping for Defender and Sentinel config preservation.
- HEF publish behavior for policy/profile normalization.
- Failure taxonomy and summary building.
- Frontend publish/settings behavior for newly introduced fields.

## Migration Notes

New migrations introduced during this implementation stream:

- `0028_platformcredential_profiles.py`
- `0029_opentidepublishprofile_kql_target_policy.py`
- `0030_opentidehefpublishjob_failure_summary.py`

Apply migrations in backend before validating runtime behavior.

## Operational Notes

- Backend test execution in constrained environments may fail if `pytest`/Django deps are missing.
- Frontend typecheck/tests were used to validate UI changes where backend runtime was unavailable.
- Existing flows are intentionally backward compatible, with new fields defaulting safely.

## Current Outcome

The platform is now materially Defender/Sentinel-first:

- richer Defender Graph payload semantics,
- first-class Sentinel MDR/deployer treatment,
- profile-aware credentials,
- policy-aware KQL routing,
- and structured, persisted failure diagnostics across HEF jobs and UI.
