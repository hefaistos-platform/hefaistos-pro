# HEX v2.0 Quick Reference Card

## TL;DR - What Changed?

**Old Format (V1):**
```json
{
  "hefaistos_version": "1.0",
  "export_type": "playbook_graph",
  "playbook": { ...all data flat... }
}
```

**New Format (HEX v2.0):**
```json
{
  "hex_format": "2.0",
  "metadata": { ... },
  "capability_abstraction": { layers with nodes },
  "graph_structure": { nodes and edges },
  "detection_logic": { ... },
  ...9 clear sections...
}
```

---

## Quick Start - 60 Seconds

### Minimal Playbook Template

```json
{
  "hex_format": "2.0",
  "metadata": {
    "name": "T1234 - Attack Technique Name",
    "version": "1.0.0",
    "status": "DEVELOPMENT"
  },
  "capability_abstraction": {
    "mission": {
      "goal": "Your objective here",
      "description": "Description here"
    },
    "layers": [
      {
        "layer_id": "layer_1",
        "layer_name": "Detection Layer",
        "capability": "Signal Generation",
        "nodes": ["node_1"]
      }
    ]
  },
  "graph_structure": {
    "nodes": [
      {
        "id": "node_1",
        "name": "Your Detection Node",
        "type": "detection",
        "layer": "layer_1",
        "position": {"x": 100, "y": 100},
        "color": "#FF6B6B"
      }
    ],
    "edges": []
  }
}
```

---

## Section Cheat Sheet

| Section | Purpose | Required? | Example |
|---------|---------|-----------|---------|
| `hex_format` | Format version | YES | `"2.0"` |
| `metadata` | Playbook info | YES | name, version, status |
| `strategy` | MITRE alignment | NO | techniques, approach |
| `capability_abstraction` | Layer mapping | YES | mission, layers |
| `detection_logic` | Detection rule | NO | rule, data sources |
| `operational_context` | Analyst info | NO | triage, response |
| `testing` | Test guidance | NO | scenario, expected output |
| `soar_configuration` | Automation | NO | enrichment, containment |
| `graph_structure` | Nodes & edges | YES | nodes, edges |
| `audit_trail` | Quality info | NO | robustness, validation |

---

## Field Reference (By Frequency of Use)

### MUST HAVE
```json
{
  "hex_format": "2.0",
  "metadata": {
    "name": "String - Playbook name with MITRE ID",
    "version": "String - e.g., '1.0.0'",
    "status": "DEVELOPMENT|TESTING|TUNING|DEPLOYED"
  },
  "capability_abstraction": {
    "mission": {
      "goal": "String - What you're trying to achieve",
      "description": "String - Why it matters"
    },
    "layers": [
      {
        "layer_id": "String - layer_1, layer_2, etc.",
        "layer_name": "String - Detection/Enrichment/Response",
        "capability": "String - What this layer does",
        "nodes": ["node_1", "node_2"]  // Array of node IDs
      }
    ]
  },
  "graph_structure": {
    "nodes": [
      {
        "id": "String - node_1, node_2, etc.",
        "name": "String - Display name",
        "type": "detection|enrichment|response",
        "layer": "String - layer_1 (must match a layer_id)",
        "position": { "x": 100, "y": 100 },
        "color": "String - Hex color #RRGGBB"
      }
    ],
    "edges": [
      {
        "id": "String - edge_1, edge_2, etc.",
        "source": "String - node_id",
        "target": "String - node_id"
      }
    ]
  }
}
```

### SHOULD HAVE
```json
{
  "strategy": {
    "mitre_techniques": [
      {
        "technique_id": "T1003.001",
        "name": "String - Technique name",
        "tactic": "String - Credential Access, etc."
      }
    ]
  },
  "detection_logic": {
    "detection_rule": "String - Actual SIGMA/YARA rule",
    "rule_format": "sigma|yara",
    "blind_spots": ["String - Detection limitations"]
  },
  "operational_context": {
    "goal": "String - Operational objective",
    "triage_guidance": "String - Step-by-step instructions",
    "response_playbook": "String - Manual response steps",
    "false_positives": ["String - Known FP sources"]
  }
}
```

### NICE TO HAVE
```json
{
  "metadata": {
    "description": "String - Longer description",
    "tags": ["String - tag1", "tag2"],
    "created_by": "String - Email",
    "created_date": "String - ISO 8601",
    "last_modified": "String - ISO 8601"
  },
  "testing": {
    "test_scenario": "String - How to test",
    "test_expected_output": "String - Expected behavior",
    "test_environment": "String - OS, tools needed"
  },
  "soar_configuration": {
    "alert_trigger": "String - Alert name",
    "default_severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "enrichment_steps": [...],
    "containment_steps": [...],
    "notification_steps": [...]
  },
  "audit_trail": {
    "robustness_level": 1-5,
    "data_source_robustness": "String",
    "validation_status": "String"
  }
}
```

---

## Common Tasks

### Task: Create Detection Playbook

1. Start with minimal template
2. Fill metadata (name, version, status)
3. Add MITRE techniques to strategy
4. Create "Detection Layer" in capability_abstraction
5. Add 1-2 detection nodes to graph
6. Add detection_logic with SIGMA rule
7. Add operational_context with triage steps
8. Import and visualize

### Task: Create Response Playbook

1. Start with minimal template
2. Fill metadata
3. Create multiple layers:
   - "Detection Layer" - Alert nodes
   - "Enrichment Layer" - Data collection nodes
   - "Response Layer" - Action nodes
4. Connect nodes with edges
5. Add soar_configuration with containment steps
6. Import and test

### Task: Convert Old Playbook to HEX v2.0

1. Export from HEFAISTOS (auto-converts)
2. OR manually create new structure:
   - Copy detection_rule to detection_logic
   - Copy goal/context to operational_context
   - Extract MITRE techniques
   - Export graph nodes/edges as-is
   - Map nodes to layers

### Task: Share Playbook with Team

1. Export from HEFAISTOS (generates HEX v2.0)
2. Send JSON file
3. Team member opens HEFAISTOS
4. Click Import, drag & drop file
5. Playbook created automatically

---

## Color Codes (Recommended)

```
Detection Layer:    #FF6B6B (Red)
Enrichment Layer:   #4ECDC4 (Teal)
Response Layer:     #95E1D3 (Light Green)
Network Node:       #FFD93D (Yellow)
Identity Node:      #6BCB77 (Green)
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid JSON" | Syntax error | Use JSONLint.com |
| "Missing metadata.name" | No title | Add `"name": "..."` |
| "Node X not found" | Edge references wrong ID | Check node IDs exactly |
| "Unknown layer layer_1" | Node references missing layer | Add layer to capability_abstraction |
| "Node in edges but not in graph" | Edge node missing | Add missing node to nodes array |

---

## Validation Checklist

- [ ] `hex_format` is `"2.0"`
- [ ] All node IDs in edges exist in nodes
- [ ] All layer IDs referenced by nodes exist
- [ ] All node IDs in layers exist in nodes array
- [ ] No circular edges (A→B→A)
- [ ] Metadata has name, version, status
- [ ] No duplicate node/edge/layer IDs
- [ ] Positions are numbers, not strings
- [ ] Colors are valid hex codes

---

## File Naming Convention

```
{technique_id}_{technique_name}_{date}.json

Examples:
T1003_001_credential_dumping_2026_02_05.json
T1566_001_phishing_2026_02_05.json
```

---

## Layer Types Explained

### Detection Layer
**Purpose:** Generate initial alert signals
**Node Types:** Log parsers, rule evaluators, data correlation engines
**Output:** Alerts or anomaly scores
**Example Nodes:**
- Windows Event Log Parser
- Sysmon Event Analyzer
- Pattern Matcher

### Enrichment Layer  
**Purpose:** Add context to alerts
**Node Types:** Data aggregators, context lookups, timeline builders
**Output:** Enriched alert with full context
**Example Nodes:**
- Process Ancestry Builder
- Network Connection Mapper
- File Association Resolver

### Response Layer
**Purpose:** Execute automated or manual responses
**Node Types:** Action executors, notification senders, playbook runners
**Output:** Containment, notifications, incidents
**Example Nodes:**
- Host Isolator
- Credential Reset Service
- Slack Notifier

---

## Tips & Tricks

1. **Start Simple** - Minimal nodes first, add complexity later
2. **Use Layers** - Even simple playbooks benefit from layer organization
3. **Comment** - Add `// comments` in descriptions, not in JSON
4. **Test Exports** - Export from HEFAISTOS to see format in action
5. **Reuse Templates** - Copy sample playbook, modify for your technique
6. **Version Everything** - Track changes in version field and notes
7. **Document Blind Spots** - Every detection has limitations - list them
8. **Link to MITRE** - Always include technique_id and name

---

## Resources

- **Full Guide:** `HEX_V2_IMPLEMENTATION_GUIDE.md`
- **Sample Playbook:** `SAMPLE_HEX_V2_PLAYBOOK.json`
- **Proposal:** `HEX_FORMAT_V2_PROPOSAL.md`
- **JSON Validator:** https://jsonschema.net/

---

**Format Version:** 2.0  
**Last Updated:** February 5, 2026  
**Quick Ref Version:** 1.0
