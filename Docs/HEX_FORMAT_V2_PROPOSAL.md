# HEFAISTOS Playbook Export/Import Format - Standardization Proposal

## Current State Analysis

### Existing Format Issues
The current export format includes:
- ✅ Basic workbench metadata (title, status, tags, version)
- ✅ MITRE technique mappings
- ✅ Detection rules and deep dive content
- ✅ Graph structure (nodes and edges)
- ✅ SOAR configuration
- ❌ **NO Capability Abstraction data** - This is a major gap
- ⚠️ Complex nested structure that's hard to manually edit
- ⚠️ Graph nodes lack semantic meaning (no layer types, capability mappings)

### Developer Pain Points
1. Can't see what capabilities/tactics are being covered
2. Node structure doesn't indicate which abstraction layer they belong to
3. Complex object structure makes manual editing difficult
4. No clear validation rules documented

---

## Proposed Solution: HEX Format v2.0

A clean, human-readable, developer-friendly JSON schema with:
1. **Clear sections** for different concerns
2. **Capability Abstraction layers** explicitly mapped
3. **Validation rules** included in schema
4. **Comments/documentation** fields
5. **Version tracking** for future compatibility

### Format Structure

```json
{
  "hex_format": "2.0",
  "metadata": {
    "name": "T1003 - Credential Dumping - LSASS Extraction",
    "description": "Detection and response playbook for LSASS credential dumping techniques",
    "version": "1.0.0",
    "status": "DEVELOPMENT",
    "tags": ["credential-access", "credential-dumping", "lsass"],
    "created_by": "analyst@example.com",
    "created_date": "2026-02-05",
    "last_modified": "2026-02-05"
  },

  "strategy": {
    "mitre_techniques": [
      {
        "technique_id": "T1003.001",
        "name": "Credential Dumping: LSASS Memory",
        "tactic": "Credential Access"
      }
    ],
    "detection_approach": "Behavioral detection of memory access patterns combined with process monitoring",
    "selected_detection_method": "Windows Event Logs + EDR telemetry"
  },

  "capability_abstraction": {
    "mission": {
      "goal": "Detect and respond to LSASS credential dumping attacks",
      "description": "Organizations need visibility into attempts to extract credentials from LSASS process memory"
    },
    "layers": [
      {
        "layer_id": "layer_1",
        "layer_name": "Detection Layer",
        "capability": "Memory Access Monitoring",
        "description": "Monitor for suspicious memory access to LSASS process",
        "nodes": ["node_1", "node_2"]
      },
      {
        "layer_id": "layer_2",
        "layer_name": "Enrichment Layer",
        "capability": "Process Context Analysis",
        "description": "Enrich alerts with process ancestry and file operations",
        "nodes": ["node_3"]
      },
      {
        "layer_id": "layer_3",
        "layer_name": "Response Layer",
        "capability": "Automated Response Execution",
        "description": "Execute containment and remediation steps",
        "nodes": ["node_4", "node_5"]
      }
    ]
  },

  "detection_logic": {
    "detection_rule": "rule T1003_001_LSASS_Memory_Dump { ... }",
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
        "required_fields": ["SourceImage", "TargetImage", "GrantedAccess"]
      }
    ],
    "blind_spots": [
      "Detection may miss dumps using kernel-mode techniques",
      "Encrypted memory regions may bypass heuristics"
    ]
  },

  "operational_context": {
    "goal": "Enable SOC teams to detect and respond to LSASS memory dumps within 15 minutes",
    "technical_context": "LSASS (Local Security Authority Subsystem Service) stores credentials in memory. Attackers use tools like Mimikatz to dump credentials.",
    "false_positives": [
      "Legitimate memory analysis tools (WinDbg, IDA)",
      "Windows Defender scans",
      "Some EDR software accessing LSASS"
    ],
    "triage_guidance": "Review parent process and user account. Service accounts dumping LSASS are highly suspicious.",
    "response_playbook": "1. Isolate host\n2. Collect memory dump\n3. Terminate dumping process\n4. Reset credentials"
  },

  "testing": {
    "test_scenario": "Use Mimikatz to dump LSASS credentials and verify detection",
    "test_expected_output": "Alert should fire within 2 seconds with process name, user, and target process",
    "test_environment": "Windows 10/11, domain-joined",
    "target_file_path": "/detections/windows/credential_access/t1003_lsass_dump.sigma"
  },

  "soar_configuration": {
    "alert_trigger": "T1003_001_LSASS_Memory_Dump",
    "default_severity": "HIGH",
    "enrichment_steps": [
      {
        "step": 1,
        "name": "Get Process Timeline",
        "description": "Query EDR for all process events for the dumping process",
        "action": "query_edr"
      },
      {
        "step": 2,
        "name": "Check Credential Usage",
        "description": "Check if dumped credentials were used elsewhere",
        "action": "query_logs"
      }
    ],
    "containment_steps": [
      {
        "step": 1,
        "name": "Isolate Host",
        "description": "Disconnect host from network",
        "action": "network_isolate"
      },
      {
        "step": 2,
        "name": "Terminate Process",
        "description": "Kill the dumping process",
        "action": "process_kill"
      }
    ],
    "notification_steps": [
      {
        "step": 1,
        "channel": "slack",
        "template": "lsass_dump_alert"
      }
    ]
  },

  "graph_structure": {
    "nodes": [
      {
        "id": "node_1",
        "name": "Windows Event Log Parser",
        "type": "detection",
        "layer": "layer_1",
        "description": "Parse and analyze Sysmon event ID 10 for LSASS access",
        "position": { "x": 100, "y": 100 },
        "color": "#FF6B6B",
        "mitre_techniques": ["T1003.001"]
      },
      {
        "id": "node_2",
        "name": "Access Pattern Analysis",
        "type": "detection",
        "layer": "layer_1",
        "description": "Analyze access patterns to identify suspicious behavior",
        "position": { "x": 300, "y": 100 },
        "color": "#FF6B6B",
        "mitre_techniques": ["T1003.001"]
      },
      {
        "id": "node_3",
        "name": "Enrich with Process Info",
        "type": "enrichment",
        "layer": "layer_2",
        "description": "Add process ancestry, file operations",
        "position": { "x": 200, "y": 250 },
        "color": "#4ECDC4",
        "mitre_techniques": []
      },
      {
        "id": "node_4",
        "name": "Execute Containment",
        "type": "response",
        "layer": "layer_3",
        "description": "Trigger automated response actions",
        "position": { "x": 100, "y": 400 },
        "color": "#95E1D3",
        "mitre_techniques": []
      },
      {
        "id": "node_5",
        "name": "Notify SOC",
        "type": "response",
        "layer": "layer_3",
        "description": "Send notifications to SOC team",
        "position": { "x": 300, "y": 400 },
        "color": "#95E1D3",
        "mitre_techniques": []
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "source": "node_1",
        "target": "node_3",
        "label": "trigger"
      },
      {
        "id": "edge_2",
        "source": "node_2",
        "target": "node_3",
        "label": "trigger"
      },
      {
        "id": "edge_3",
        "source": "node_3",
        "target": "node_4",
        "label": "trigger"
      },
      {
        "id": "edge_4",
        "source": "node_3",
        "target": "node_5",
        "label": "trigger"
      }
    ]
  },

  "audit_trail": {
    "robustness_level": 4,
    "data_source_robustness": "Sysmon events are reliable and comprehensive",
    "data_source_maturity": "Mature - available since Windows Vista",
    "notes": "This detection is part of the critical infrastructure monitoring program",
    "validation_status": "Tested in production - low false positive rate"
  }
}
```

---

## Key Improvements

### 1. **Clear Section Organization**
- `metadata` - Basic info
- `strategy` - MITRE alignment
- `capability_abstraction` - **NEW: Explicit layer mapping**
- `detection_logic` - Detection approach and rules
- `operational_context` - Deep dive information
- `testing` - Testing guidance
- `soar_configuration` - Automated response
- `graph_structure` - Visual workbench structure
- `audit_trail` - Robustness and notes

### 2. **Capability Abstraction Integration**
```json
"capability_abstraction": {
  "mission": { ... },
  "layers": [
    {
      "layer_id": "layer_1",
      "layer_name": "Detection Layer",
      "capability": "Memory Access Monitoring",
      "nodes": ["node_1", "node_2"]
    }
  ]
}
```
- Each layer maps to specific nodes
- Capability name is explicit
- References back to graph nodes

### 3. **Developer-Friendly**
- Flat, readable structure
- Comments explain each section
- Easy to manually edit and validate
- Step-by-step instructions (enrichment, containment, notifications)

### 4. **Backward Compatible**
- Can convert from old format to new format
- Can convert from new format to GraphQL mutations
- Version tracking allows future migrations

---

## Implementation Roadmap

### Phase 1: Schema Definition
- [ ] Create HEX v2.0 JSON schema with validation rules
- [ ] Document all required vs optional fields
- [ ] Create examples for different use cases

### Phase 2: Conversion Functions
- [ ] `serializeToHEXv2(playbookGraph)` - Export to new format
- [ ] `deserializeFromHEXv2(hexData, organization, author)` - Import from new format
- [ ] `migrateFromV1toV2(oldFormat)` - Migrate existing exports

### Phase 3: Frontend Updates
- [ ] Update `ExportImportModal` to support both formats
- [ ] Add format selector (V1 legacy or V2 new)
- [ ] Show format validation errors clearly
- [ ] Add sample/template download

### Phase 4: Documentation & Tools
- [ ] Create developer guide for HEX v2.0 format
- [ ] Provide sample playbooks for common attack techniques
- [ ] Create CLI tool for validation
- [ ] Add format converter utility

### Phase 5: Backend Implementation
- [ ] Implement GraphQL mutations for v2 export/import
- [ ] Add validation logic
- [ ] Error handling and detailed messages

---

## Questions for User Approval

### 1. **Format Acceptance**
   - Does the proposed HEX v2.0 structure meet your needs?
   - Are there any sections you'd like to add/remove?
   - Any fields that should be required vs optional?

### 2. **Backward Compatibility**
   - Should we maintain support for the old format?
   - Or deprecate V1 and migrate all existing playbooks?

### 3. **Capability Abstraction Mapping**
   - Should the format enforce layer structure?
   - Or allow flexible node grouping?

### 4. **Implementation Priority**
   - Start with export (easier)?
   - Or full bidirectional support immediately?

### 5. **External Distribution**
   - Will developers outside HEFAISTOS create playbooks with this format?
   - Do we need community guidelines/templates?

---

## Benefits After Implementation

✅ **For End Users**
- Ability to understand and manually edit exports
- Clear capability layer visibility
- Better testing and deployment docs

✅ **For Developers**
- Standardized format for creating new playbooks
- Can create playbooks in JSON files before importing
- Clear structure for programmatic generation

✅ **For Organization**
- Reusable playbook library
- Community contribution support
- Better documentation standards

---

**Please review this proposal and provide feedback on:**
1. Does this format meet your requirements?
2. Any additions/modifications needed?
3. Should we support legacy V1 format during transition?
4. Priority: Export first, or full bidirectional?

Once you approve, I'll implement the complete solution.
