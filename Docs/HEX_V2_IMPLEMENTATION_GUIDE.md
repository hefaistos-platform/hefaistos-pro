# HEX v2.0 Format - Implementation Guide

## Overview

HEX v2.0 (HEFAISTOS Export format version 2.0) is the standardized JSON format for creating, exporting, and importing playbooks in HEFAISTOS platform. It's designed to be:

- **Human-readable** - Easy to understand and manually edit
- **Developer-friendly** - Clear structure for programmatic generation
- **Complete** - Includes all playbook data including capability abstraction layers
- **Validated** - Clear validation rules for all required fields
- **Extensible** - Allows new fields without breaking compatibility

---

## Format Specification

### Root Level Structure

```json
{
  "hex_format": "2.0",
  "metadata": {...},
  "strategy": {...},
  "capability_abstraction": {...},
  "detection_logic": {...},
  "operational_context": {...},
  "testing": {...},
  "soar_configuration": {...},
  "graph_structure": {...},
  "audit_trail": {...}
}
```

### 1. Metadata Section (REQUIRED)

Contains basic information about the playbook.

```json
"metadata": {
  "name": "T1003.001 - Credential Dumping: LSASS Memory",
  "description": "Detection and response playbook for LSASS credential dumping",
  "version": "1.0.0",
  "status": "DEVELOPMENT",
  "tags": ["credential-access", "lsass", "critical"],
  "created_by": "analyst@example.com",
  "created_date": "2026-02-05",
  "last_modified": "2026-02-05"
}
```

**Required Fields:**
- `name` (string) - Playbook title, typically includes MITRE technique ID
- `version` (string) - Version in semantic format (1.0.0)
- `status` (string) - One of: DEVELOPMENT, TESTING, TUNING, DEPLOYED

**Optional Fields:**
- `description` - Playbook summary
- `tags` - Array of tags for categorization
- `created_by` - Email or username
- `created_date` - ISO 8601 date
- `last_modified` - ISO 8601 date

---

### 2. Strategy Section (OPTIONAL)

MITRE ATT&CK alignment and detection strategy.

```json
"strategy": {
  "mitre_techniques": [
    {
      "technique_id": "T1003.001",
      "name": "Credential Dumping: LSASS Memory",
      "tactic": "Credential Access"
    }
  ],
  "detection_approach": "Behavioral detection of memory access patterns",
  "selected_detection_method": "Windows Event Logs + EDR telemetry"
}
```

**Fields:**
- `mitre_techniques` - Array of MITRE technique objects
  - `technique_id` - e.g., "T1003.001"
  - `name` - Full technique name
  - `tactic` - ATT&CK tactic
- `detection_approach` - High-level description of detection strategy
- `selected_detection_method` - Specific tools/methods used

---

### 3. Capability Abstraction Section (REQUIRED)

Maps capabilities to graph layers - **UNIQUE TO HEX v2.0**.

```json
"capability_abstraction": {
  "mission": {
    "goal": "Detect LSASS credential dumping within 15 minutes",
    "description": "LSASS stores credentials exploitable for lateral movement"
  },
  "layers": [
    {
      "layer_id": "layer_1",
      "layer_name": "Detection Layer",
      "capability": "Memory Access Monitoring",
      "description": "Monitor suspicious LSASS memory access",
      "nodes": ["node_1", "node_2"]
    },
    {
      "layer_id": "layer_2",
      "layer_name": "Enrichment Layer",
      "capability": "Process Context Analysis",
      "description": "Enrich alerts with process ancestry",
      "nodes": ["node_3"]
    },
    {
      "layer_id": "layer_3",
      "layer_name": "Response Layer",
      "capability": "Automated Containment",
      "description": "Execute containment and notifications",
      "nodes": ["node_4", "node_5"]
    }
  ]
}
```

**Layer Types (Typical):**
- **Detection Layer** - Initial signal generation
- **Enrichment Layer** - Data aggregation and context
- **Response Layer** - Automated or manual response

Each layer explicitly lists node IDs that belong to it.

---

### 4. Detection Logic Section (OPTIONAL)

Detection rule and data sources.

```json
"detection_logic": {
  "detection_rule": "title: LSASS Credential Dumping\n...",
  "rule_format": "sigma",
  "data_sources": [
    {
      "source": "Windows Event Logs",
      "event_ids": [10],
      "provider": "Microsoft-Windows-Sysmon/Operational"
    },
    {
      "source": "EDR Telemetry",
      "event_type": "ProcessAccess",
      "required_fields": ["SourceImage", "TargetImage"]
    }
  ],
  "blind_spots": [
    "Kernel-mode evasion techniques",
    "Encrypted memory regions"
  ]
}
```

**Fields:**
- `detection_rule` - Full rule content (SIGMA, YARA, etc.)
- `rule_format` - "sigma", "yara", "sigma-rule", etc.
- `data_sources` - Array of data source specifications
- `blind_spots` - Array of strings describing detection gaps

---

### 5. Operational Context Section (OPTIONAL)

Deep dive information for analysts.

```json
"operational_context": {
  "goal": "Enable SOC teams to detect and respond within 15 minutes",
  "technical_context": "LSASS stores credentials in memory...",
  "false_positives": [
    "Legitimate memory analysis tools (WinDbg, IDA Pro)",
    "Windows Defender scanning LSASS",
    "Performance monitoring tools"
  ],
  "triage_guidance": "1. Review parent process\n2. Check if account is legitimate...",
  "response_playbook": "1. Isolate host\n2. Collect memory dump\n3. Reset passwords..."
}
```

**Fields:**
- `goal` - Operational objective
- `technical_context` - Attack technique explanation
- `false_positives` - Array of known FP sources
- `triage_guidance` - Step-by-step triage instructions
- `response_playbook` - Manual response steps

---

### 6. Testing Section (OPTIONAL)

Testing guidance and deployment paths.

```json
"testing": {
  "test_scenario": "Use Mimikatz 'sekurlsa::logonpasswords' to dump LSASS",
  "test_expected_output": "Alert fires within 2 seconds with process info",
  "test_environment": "Windows 10/11, domain-joined, Sysmon enabled",
  "target_file_path": "/detections/windows/credential_access/t1003_001.sigma"
}
```

**Fields:**
- `test_scenario` - How to test this detection
- `test_expected_output` - Expected alert format
- `test_environment` - Required test environment
- `target_file_path` - Deployment path in repo

---

### 7. SOAR Configuration Section (OPTIONAL)

Automated response orchestration.

```json
"soar_configuration": {
  "alert_trigger": "T1003_001_LSASS_Memory_Dump",
  "default_severity": "HIGH",
  "enrichment_steps": [
    {
      "step": 1,
      "name": "Get Process Timeline",
      "description": "Query EDR for process events",
      "action": "query_edr"
    }
  ],
  "containment_steps": [
    {
      "step": 1,
      "name": "Isolate Host",
      "description": "Disconnect from network",
      "action": "network_isolate"
    }
  ],
  "notification_steps": [
    {
      "step": 1,
      "channel": "slack",
      "template": "lsass_dump_alert"
    }
  ]
}
```

**Fields:**
- `alert_trigger` - Alert rule name
- `default_severity` - CRITICAL, HIGH, MEDIUM, LOW
- `enrichment_steps` - Array of enrichment tasks
- `containment_steps` - Array of containment tasks
- `notification_steps` - Array of notification channels

Each step has:
- `step` - Sequential number
- `name` - Step name
- `description` - What it does
- Step-specific fields (action, channel, template, etc.)

---

### 8. Graph Structure Section (REQUIRED)

Nodes and edges describing the playbook flow.

```json
"graph_structure": {
  "nodes": [
    {
      "id": "node_1",
      "name": "Sysmon Event Parser",
      "type": "detection",
      "layer": "layer_1",
      "description": "Parse Event ID 10",
      "position": {"x": 100, "y": 100},
      "color": "#FF6B6B",
      "mitre_techniques": ["T1003.001"]
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2",
      "label": "trigger"
    }
  ]
}
```

**Node Fields:**
- `id` - Unique identifier (node_N)
- `name` - Display name
- `type` - "detection", "enrichment", "response"
- `layer` - References a layer from capability_abstraction
- `description` - What this node does
- `position` - x, y coordinates (for visualization)
- `color` - Hex color code
- `mitre_techniques` - Techniques this node maps to

**Edge Fields:**
- `id` - Unique identifier
- `source` - Source node ID
- `target` - Target node ID
- `label` - "trigger" or other relationship type

---

### 9. Audit Trail Section (OPTIONAL)

Validation and maturity information.

```json
"audit_trail": {
  "robustness_level": 4,
  "data_source_robustness": "Sysmon Event 10 is reliable",
  "data_source_maturity": "Mature - available since Vista",
  "notes": "Tested in production environment",
  "validation_status": "Validated - tested against Mimikatz"
}
```

**Fields:**
- `robustness_level` - 1-5 scale
- `data_source_robustness` - Reliability assessment
- `data_source_maturity` - How mature the data source is
- `notes` - Additional notes
- `validation_status` - Validation status

---

## Usage Examples

### Creating a Playbook from Scratch

1. **Start with template** (provided in HEFAISTOS)
2. **Fill in metadata** (required)
3. **Add strategy section** (MITRE techniques)
4. **Define capability layers** in `capability_abstraction`
5. **Create nodes** in `graph_structure`
6. **Connect nodes** with edges
7. **Add detection logic** if applicable
8. **Document operational context**
9. **Import into HEFAISTOS**

### Creating from Existing Rules

If you have existing detection rules:

1. Take the detection rule content
2. Identify the MITRE technique(s) it maps to
3. Extract the detection logic
4. Create simple graph with:
   - Detection node
   - Optional enrichment nodes
   - Optional response nodes
5. Fill in remaining sections
6. Import and visualize in HEFAISTOS

---

## Validation Rules

### Must Have (REQUIRED)
- `hex_format: "2.0"` - Identifies format version
- `metadata.name` - Playbook name/title
- `metadata.version` - Semantic version
- `metadata.status` - Current status
- `capability_abstraction.layers` - At least one layer
- `graph_structure.nodes` - At least one node
- `graph_structure.edges` - At least one edge OR no edges is fine for simple playbooks

### Should Have (RECOMMENDED)
- `strategy.mitre_techniques` - MITRE alignment
- `detection_logic.detection_rule` - Actual detection logic
- `operational_context.goal` - Clear objective
- `testing.test_scenario` - How to test
- `audit_trail.robustness_level` - Quality indicator

### Optional
- Everything else can be omitted if not applicable

---

## Import/Export Workflow

### Exporting from HEFAISTOS

1. Open a playbook in Workbench
2. Click "Export / Import Playbook" button
3. Click "Generate Export" tab
4. Click "Generate Export" button
5. Choose "Download as File" or copy text
6. Save file (format: `playbook_name_export.json`)

### Importing into HEFAISTOS

1. Open any playbook in Workbench
2. Click "Export / Import Playbook" button
3. Click "Import" tab
4. Either:
   - Drag & drop a `.json` file
   - Paste JSON text directly
   - Upload from file picker
5. Optionally override title
6. Click "Import Playbook"
7. New playbook created automatically

---

## Best Practices

### 1. Naming Conventions

- **Metadata.name**: Include MITRE technique ID
  - Good: "T1003.001 - Credential Dumping: LSASS Memory"
  - Bad: "My Detection"

- **Node names**: Clear, action-oriented
  - Good: "Windows Event Log Parser", "Process Ancestry Enrichment"
  - Bad: "Node1", "Step"

- **Layer names**: Consistent pattern
  - Good: "Detection Layer", "Enrichment Layer", "Response Layer"
  - Bad: "First", "Middle", "End"

### 2. Documentation

- Fill in descriptions completely
- Use triage_guidance for actionable steps
- Include false_positives list
- Document blind_spots explicitly

### 3. Capability Mapping

- Each node MUST reference its layer
- Each layer MUST list its nodes
- Layers should follow logical flow (Detection → Enrichment → Response)

### 4. Testing

- Always include test_scenario
- Document expected behavior
- Note environment requirements
- Update validation_status after testing

### 5. Versioning

- Use semantic versioning (major.minor.patch)
- Increment version when making changes
- Track last_modified date
- Add notes for changes in audit_trail

---

## Troubleshooting

### Import Fails with "Invalid JSON"

Check:
- JSON syntax is valid (use JSONLint)
- All quotes are straight quotes (not curly quotes)
- All commas properly placed
- No trailing commas

### Import Fails with "Missing metadata.name"

Add or fix:
```json
"metadata": {
  "name": "Your Playbook Name"
}
```

### Nodes Not Connecting

Check:
- Node IDs in edges exist in nodes array
- Use exact same ID (case-sensitive)
- Edges have source and target

### Nodes Not in Layers

Check:
- Each node has a "layer" field
- Layer ID matches a layer_id in capability_abstraction.layers
- Layer lists that node ID in its "nodes" array

### Import Creates Nodes But No Edges

Check:
- Edges section exists and is not empty
- Edges have valid source/target IDs
- No typos in node IDs

---

## Tools & Resources

### Official Tools
- HEFAISTOS UI - Full visual editor
- HEX Validator - JSON schema validator (coming soon)
- HEX CLI - Command-line tools (coming soon)

### External Tools
- [JSONLint](https://jsonlint.com/) - Validate JSON syntax
- [JSON Schema Validator](https://www.jsonschemavalidator.net/) - Validate against schema
- [VS Code](https://code.visualstudio.com/) - Recommended editor with JSON support

### Sample Playbooks
- See `SAMPLE_HEX_V2_PLAYBOOK.json` for complete example
- Additional templates in `/Docs/hex_v2_templates/`

---

## Support & Feedback

For questions, issues, or feedback:
- Check documentation in `/Docs/HEX_FORMAT_V2_*.md`
- Review sample playbooks
- Open issue in project tracker
- Contact security team

---

**Last Updated:** February 5, 2026
**Format Version:** 2.0
**Document Version:** 1.0
