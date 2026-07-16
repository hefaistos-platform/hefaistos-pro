# Waiting Room: Workbench Promotion and Tag-Gated MISP Import

## Overview

This document describes changes to the Waiting Room module introduced in **PR #1**.

Two capabilities were added or updated:

1. **Promotion response semantics** — `promoteWaitingCaseToWorkbench` now returns a `workbench` field as the primary result, with the previous `graph` field retained as a deprecated backward-compatibility alias.
2. **Tag-gated MISP import** — `importWaitingCasesFromMisp` accepts an optional `tag` argument. When provided, only MISP events carrying that tag are imported; events without the tag are silently skipped and counted in `skippedCount`.

---

## Promotion Response Semantics

### Before

The promotion mutation returned only `graph` (a `PlaybookGraph` object), which tied the API surface to the legacy `PlaybookGraph` naming convention.

### After

The mutation now returns both fields:

| Field | Type | Status |
|-------|------|--------|
| `workbench` | `PlaybookGraphType` | **Primary** — use this field in all new code |
| `graph` | `PlaybookGraphType` | **Deprecated** — retained for backward compatibility; will be removed in a future release |

Both fields resolve to the same `PlaybookGraph` object. The `graph` field carries the deprecation reason `"Use workbench field instead. graph will be removed in a future release."` in the GraphQL schema.

### Example

```graphql
mutation PromoteCase($id: UUID!) {
  promoteWaitingCaseToWorkbench(id: $id) {
    success
    message
    waitingCase { id status }
    workbench { id title }
    graph { id title }   # deprecated alias — prefer workbench
  }
}
```

---

## Tag-Gated MISP Import

### Arguments

`importWaitingCasesFromMisp` accepts the following arguments (all optional except `mispInstanceId`):

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `mispInstanceId` | `UUID!` | Yes | UUID of the MISP instance to import from |
| `eventId` | `String` | No | Import a single event by MISP event ID |
| `tag` | `String` | No | Only import events that carry this tag |
| `limit` | `Int` | No | Maximum number of events to fetch (default: 25) |
| `runAiEnrichment` | `Boolean` | No | Queue AI enrichment for imported cases (default: false) |

### Behavior

When `tag` is supplied:

1. MISP events are fetched as usual (respecting `limit` and `eventId`).
2. Tag presence is checked at two levels for deterministic filtering:
   - During **fetch normalization** (`normalize_misp_event`).
   - At **mutation level** via `event_has_tag` before any database write.
3. Events that do not carry the required tag are **skipped** — no `WaitingCase` record is created, and the event is counted in `skippedCount`.
4. Already-existing cases (duplicate `misp_event_id` for the same instance) are also counted in `skippedCount`.

When `tag` is omitted or empty, all fetched events are eligible for import (existing deduplication behavior still applies).

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `Boolean` | `true` if the operation completed without error |
| `message` | `String` | Human-readable summary (e.g., `"Imported 3 waiting cases from MISP."`) |
| `importedCount` | `Int` | Number of new `WaitingCase` records created |
| `skippedCount` | `Int` | Number of events skipped (tag mismatch, duplicate, or missing event ID) |
| `waitingCases` | `[WaitingCaseType]` | Newly created waiting cases |

### Example

```graphql
mutation ImportWaitingCasesFromMisp($mispInstanceId: UUID!, $tag: String) {
  importWaitingCasesFromMisp(mispInstanceId: $mispInstanceId, tag: $tag) {
    success
    message
    importedCount
    skippedCount
    waitingCases {
      id
      title
      status
    }
  }
}
```

**Variables (tag filter enabled):**

```json
{
  "mispInstanceId": "550e8400-e29b-41d4-a716-446655440000",
  "tag": "HEFAISTOS"
}
```

**Variables (no tag filter):**

```json
{
  "mispInstanceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Frontend Changes

The Waiting Room MISP import modal was updated:

- A new **"Required tag (optional)"** text input was added to the import form.
- When filled in, the value is sent as the `tag` variable in the `importWaitingCasesFromMisp` mutation.
- After a successful promotion, the frontend now reads **`workbench`** from the `promoteWaitingCaseToWorkbench` response instead of `graph`.

No breaking UI changes were introduced — existing workflows continue to function.

---

## Backward Compatibility and Migration

### Clients reading `graph` from `promoteWaitingCaseToWorkbench`

`graph` is still returned and resolves to the same object as `workbench`. No immediate action is required.  
**Recommended migration:** update all query/mutation documents to select `workbench` instead of `graph` before the field is removed.

### Clients calling `importWaitingCasesFromMisp` without `tag`

No changes are required. Omitting `tag` preserves the previous behavior — all fetched events are processed.

### Clients that previously relied on `importedCount`/`skippedCount`

These fields were added in PR #1. If you query them on older API versions they will not exist; guard queries accordingly or ensure the backend is up to date.

---

## Required Roles

| Mutation | Required Role |
|----------|--------------|
| `createWaitingCase` | `REVIEWER`, `ADMIN` |
| `updateWaitingCase` | `REVIEWER`, `ADMIN` |
| `importWaitingCasesFromMisp` | `REVIEWER`, `ADMIN` |
| `promoteWaitingCaseToWorkbench` | `ANALYST` |
