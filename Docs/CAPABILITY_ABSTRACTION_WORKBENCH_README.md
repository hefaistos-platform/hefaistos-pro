# Capability Abstraction Library & Map for PlaybookWorkbench

## Overview

This document describes the Capability Abstraction feature as deployed in:

- `frontend/src/pages/PlaybookWorkbench.tsx`
- `frontend/src/components/playbook/CapabilityAbstractionPanel.tsx`
- `frontend/src/components/CapabilityAbstractionMapNode.tsx`
- `frontend/src/components/TechniqueRootNode.tsx`
- `frontend/src/components/CoverageGapNode.tsx`
- `frontend/src/components/CapabilityAbstractionLayerBands.tsx`
- `frontend/src/utils/capabilityAbstractionUtils.ts`

The feature has two interconnected parts:

1. **Capability Abstraction Library (CAL)** — structured knowledge panel for entering, reviewing, and selecting detection-relevant abstraction entries per ATT&CK technique.
2. **Capability Abstraction Map (CAM)** — live visual graph automatically derived from the library selections, rendering a layered, annotated capability abstraction diagram grounded in real detection engineering knowledge.

## Why This Feature Exists

Before this change, AI generation in the workbench was grounded mainly by free-text fields (title, ATT&CK technique, technical context, goal, etc.). That made it easy for generation to collapse into brittle, artifact-level logic.

The CAL+CAM integration fixes that by making detection-relevant knowledge:
- structured and technique-scoped
- visually represented as a layered abstraction map
- selectable and reusable across workbenches
- directly injected into the async AI generation pipeline

## Core Concept: Capability Abstraction Layers

A capability abstraction entry represents one detection-relevant layer for a specific ATT&CK technique, following the capability abstraction framework (see: https://specterops.io/blog/2020/02/06/capability-abstraction/).

Supported layers (ordered from most brittle to most robust):

| Layer | Description | Robustness |
|-------|-------------|------------|
| Tool / Binary | Specific binary or tool name | Lowest (ephemeral) |
| API / Export | API calls or DLL exports | Low |
| COM / IPC | COM object or IPC mechanism | Low-medium |
| Registry Object | Registry key or handler | Medium |
| Protocol | Network or inter-process protocol | Medium |
| Process Behavior | Process tree or behavioral pattern | High |
| Network Behavior | Network-level observable | Highest (invariant) |

Each entry stores:
- abstraction layer
- component / artifact
- adversary purpose
- common evasions / variations
- expected observables
- applicable telemetry
- detection value
- robustness level (1–5)
- provenance / source kind (seeded baseline or organization-custom)
- review status (DRAFT / REVIEWED / APPROVED)
- version

## Scope and Ownership Model

The library is technique-scoped and supports both:

1. **Shared baseline entries**
   - seeded by the platform
   - organization-agnostic
   - read-only in the workbench UI

2. **Organization-specific entries**
   - created and edited by engineers
   - durable over time
   - versioned and reviewable

## Current Seeded Example

The implementation seeds baseline entries for `T1218.005` (Mshta) spanning multiple layers:

- tool-level `mshta.exe`
- API / invocation behavior
- registry / handler abuse
- network retrieval behavior

This gives engineers immediate examples of weak, moderate, and stronger detection anchors for the same technique.

## Capability Abstraction Map (CAM) — Visual Layer

The CAM is a live ReactFlow canvas rendered in the top section of `PlaybookWorkbench.tsx`. It has two modes:

### Auto Mode (default)

The graph is **automatically derived** from `selectedCapabilityAbstractions` on the workbench graph. No manual node creation is needed.

The map renders:
- **ATT&CK Technique Root Node** — dark root node at the top representing the selected technique
- **Capability Abstraction Nodes** — one per selected library entry, positioned in their layer band
- **Edges** — connecting the root node to each abstraction; the detection focus layer edge is animated and highlighted in blue
- **Layer Band Backgrounds** — semi-transparent horizontal bands labeling each abstraction layer (Network Behavior at the top → Tool at the bottom)
- **Coverage Gap Nodes** — dashed red nodes shown for abstraction layers that have no selected entry, making coverage gaps immediately visible
- **Coverage Summary Bar** — in the map toggle header: total count, average robustness, per-layer badge counts

### Manual Mode

The original freehand graph editor is preserved. In Manual mode, engineers can add, rename, color, and connect nodes freely, independent of the library.

Toggle between modes using the **Auto (from Library) / Manual** button in the map header.

### Bidirectional Sync

Clicking a capability abstraction node in the map **scrolls to and highlights** the corresponding entry in the Capability Abstraction Library panel below it. The highlight fades after 2.5 seconds.

## Node Visual Encoding

Each `CapabilityAbstractionMapNode` renders:

| Visual | Meaning |
|--------|---------|
| Border color | Robustness level (red = low, green = invariant) |
| Blue border + light blue background | Detection focus layer |
| 🎯 badge | This is the selected detection focus layer |
| Purple "Baseline" badge | Seeded shared baseline entry |
| R{N} badge | Robustness level (1–5) |
| ⚠️ orange text | Common evasions warning |
| 🔍 green text | Detection value summary |
| 🎭 gray text | Adversary purpose |

## Robustness Scale

| Level | Label | Color |
|-------|-------|-------|
| 1 | Ephemeral | Red |
| 2 | Weak | Orange |
| 3 | Moderate | Gold |
| 4 | Strong | Blue |
| 5 | Invariant | Green |

## AI Generation Behavior

When the user clicks **AI Generate**, the selected capability abstractions are passed into the async generation context together with traditional workbench fields.

The AI generator uses the structured data to:
- choose the intended detection anchor
- honor the selected abstraction layer
- avoid overfitting to brittle artifacts
- account for known evasions
- connect capability entries to expected observables and telemetry
- generate format-appropriate syntax

The multi-variant output includes: primary rule, quick-win rule, robust alternative, correlation ideas, expected blind spots, suggested test guidance.

## OpenTIDE Metadata Alignment

Selected capability abstractions and the focus layer are compiled into OpenTIDE metadata, keeping detection intent aligned across workbench authoring, AI generation, and metadata export.

## Main Files Involved

### Frontend

- `frontend/src/pages/PlaybookWorkbench.tsx` — main workbench page, CAM rendering, Auto/Manual toggle, derived nodes/edges, coverage summary
- `frontend/src/components/playbook/CapabilityAbstractionPanel.tsx` — library panel, entry CRUD, selection, focus layer
- `frontend/src/components/CapabilityAbstractionMapNode.tsx` — rich custom node for CAM (robustness, evasions, focus highlight)
- `frontend/src/components/TechniqueRootNode.tsx` — ATT&CK technique root node
- `frontend/src/components/CoverageGapNode.tsx` — coverage gap indicator node
- `frontend/src/components/CapabilityAbstractionLayerBands.tsx` — layer band background renderer
- `frontend/src/utils/capabilityAbstractionUtils.ts` — shared constants and helpers (LAYER_Y, LAYER_LABELS, getRobustnessColor, getRobustnessLabel)
- `frontend/src/components/DetectionRuleEditorModal.tsx`
- `frontend/src/utils/openTideCompiler.ts`
- `frontend/src/types/opentide.ts`

### Backend

- `backend/playbooks/models.py`
- `backend/playbooks/schema.py`
- `backend/playbooks/migrations/0038_playbookgraph_detection_focus_layer_and_more.py`
- `backend/playbooks/utils/opentide_compiler.py`
- `backend/ai_assistant/schema.py`
- `backend/ai_assistant/engine.py`
- `backend/services/ai_generation_worker.py`

### Tests

- `backend/playbooks/tests/test_capability_abstractions.py`
- `backend/ai_assistant/tests.py`
- `frontend/src/utils/openTideCompiler.test.ts`

## Deployment Status

All 7 phases deployed:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Auto-derive CAM nodes/edges from CAL selections; Auto/Manual toggle | ✅ Deployed |
| 2 | Rich `CapabilityAbstractionMapNode` with robustness encoding, evasion annotations, focus badge | ✅ Deployed |
| 3 | Coverage summary bar in CAM header (count, avg robustness, per-layer badges) | ✅ Deployed |
| 4 | Layer band backgrounds (horizontal bands labeling each abstraction layer) | ✅ Deployed |
| 5 | Bidirectional click sync: map node → scroll + highlight library entry | ✅ Deployed |
| 6 | `TechniqueRootNode` as the ATT&CK technique root of the graph | ✅ Deployed |
| 7 | `CoverageGapNode` showing uncovered layers as dashed red indicators | ✅ Deployed |

## Summary

The CAL+CAM integration turns the workbench into a full capability abstraction engineering environment. The map is not decorative — it directly reflects the structured library selections, encodes detection quality visually, and makes coverage gaps immediately visible to the engineer.

It makes the workbench AI flow:
- technique-scoped
- layer-aware
- reusable
- anti-evasion-aware
- visually grounded in the capability abstraction framework
