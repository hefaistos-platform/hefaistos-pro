# D3FEND Framework Integration

## Overview

HEFAISTOS now includes comprehensive integration with the MITRE D3FEND framework, providing cybersecurity countermeasure classification, gap analysis, and defensive capability mapping.

D3FEND (Detection, Denial, and Disruption Framework Empowering Network Defense) is a knowledge graph of cybersecurity countermeasure techniques that complements MITRE ATT&CK by focusing on defensive measures rather than adversary tactics.

## Key Features

### 1. D3FEND Data Models

The platform includes three core D3FEND models:

- **D3fendDefensiveTechnique**: Defensive techniques (e.g., D3-PSA Process Spawn Analysis)
  - Hierarchical structure with parent-child relationships
  - Tactic classification (Detect, Harden, Isolate, Deceive, Evict, Model)
  - Digital artifact associations

- **D3fendDigitalArtifact**: Digital artifacts that techniques analyze/produce
  - Process artifacts, network traffic, file system objects, registry keys, etc.
  - Linked to techniques that use them

- **D3fendAttackMapping**: ATT&CK ↔ D3FEND countermeasure mappings
  - Links offensive techniques to defensive countermeasures
  - Enables gap analysis and coverage assessment

### 2. Playbook Integration

Playbooks can now be mapped to D3FEND defensive techniques:

- **PlaybookGraph**: `d3fend_techniques` field for playbook-level mappings
- **PlaybookNode**: `d3fend_mappings` field for node-level granularity

This enables tracking which defensive techniques are implemented by your detection rules and which gaps exist in your defensive coverage.

### 3. GraphQL API

The platform exposes D3FEND data through GraphQL queries:

#### List D3FEND Techniques
```graphql
query {
  allD3fendTechniques(
    search: "process"
    tactic: "Detect"
    limit: 20
    offset: 0
  ) {
    d3fendId
    name
    definition
    tactic
    digitalArtifacts {
      name
    }
  }
}
```

#### Get Single Technique
```graphql
query {
  d3fendTechnique(id: "uuid-here") {
    d3fendId
    name
    definition
    tactic
    digitalArtifacts {
      artifactId
      name
    }
    counteredAttacks {
      techniqueId
      name
    }
  }
}
```

#### Gap Analysis
```graphql
query {
  d3fendGapAnalysis(attackTechniqueId: "T1003") {
    attackTechnique {
      techniqueId
      name
    }
    recommendedCountermeasures {
      d3fendId
      name
      tactic
    }
    currentCoverage {
      d3fendId
      name
    }
    gaps {
      d3fendId
      name
    }
    coveragePercentage
  }
}
```

#### Coverage Matrix
```graphql
query {
  d3fendCoverageMatrix {
    tactic
    techniques {
      technique {
        d3fendId
        name
      }
      isCovered
      implementingPlaybooks
    }
  }
}
```

### 4. Maieutic Engine Enhancement

The Maieutic Engine now includes D3FEND context in its Socratic questioning:

**Robustness Step:**
- Suggests applicable D3FEND detection techniques
- Recommends digital artifacts to monitor
- Identifies complementary hardening measures

**Playbook Design Step:**
- Suggests D3FEND response techniques (Evict, Isolate, Deceive, Harden)
- Recommends automated countermeasures
- Maps responses to defensive capabilities

Example questions:
- "According to D3FEND, this maps to Process Spawn Analysis (D3-PSA). Are you analyzing the full process tree?"
- "D3FEND suggests Network Isolation (D3-NI) as a countermeasure. Can your SOAR trigger VLAN isolation?"

## Data Import

### Prerequisites

1. MITRE ATT&CK data must be imported first:
   ```bash
   python manage.py import_mitre_universal
   ```

2. Ensure internet connectivity to D3FEND endpoints

### Import D3FEND Data

Run the import management command:

```bash
python manage.py import_d3fend
```

This command:
1. Fetches the D3FEND ontology from `https://d3fend.mitre.org/ontologies/d3fend.json`
2. Parses the JSON-LD structure to extract defensive techniques and digital artifacts
3. Fetches ATT&CK ↔ D3FEND mappings from `https://d3fend.mitre.org/api/ontology/inference/d3fend-full-mappings.csv`
4. Creates mapping records linking ATT&CK techniques to D3FEND countermeasures

### Import Options

```bash
# Skip ontology import (mappings only)
python manage.py import_d3fend --skip-ontology

# Skip mappings import (ontology only)
python manage.py import_d3fend --skip-mappings
```

### Expected Output

```
Fetching D3FEND ontology...
Parsing ontology data...
Processing defensive techniques...
Linking parent-child relationships...
Linking digital artifacts to techniques...
Imported 487 techniques, 124 artifacts, and 892 artifact-technique links

Fetching D3FEND mappings...
Parsing CSV mappings...
Imported 1,247 ATT&CK → D3FEND mappings (skipped 34 unmatched)

D3FEND import complete!
```

## Usage in Detection Engineering

### 1. Mapping Detections to D3FEND

When creating a playbook:

1. Select the ATT&CK technique being detected
2. Review recommended D3FEND countermeasures via gap analysis
3. Add relevant D3FEND techniques to your playbook
4. Track coverage in the D3FEND Matrix view

### 2. Gap Analysis Workflow

For each ATT&CK technique in your threat model:

1. Query `d3fendGapAnalysis` with the technique ID
2. Review `recommendedCountermeasures` - what defenses exist
3. Check `currentCoverage` - what you've already implemented
4. Prioritize `gaps` - what's missing from your defense

### 3. Coverage Tracking

Use the D3FEND Coverage Matrix to:

- Visualize defensive capabilities by tactic
- Identify underutilized defensive categories
- Track which playbooks implement each technique
- Prioritize development of missing countermeasures

### 4. AI-Assisted Detection Design

When using the Maieutic Engine:

1. The AI will suggest relevant D3FEND techniques during robustness assessment
2. It will recommend digital artifacts to monitor
3. It will propose defensive response techniques during playbook design
4. Use these suggestions to enhance detection coverage

## D3FEND Tactics

### Detect
Techniques for identifying adversary activities:
- Process monitoring and analysis
- Network traffic analysis
- File system monitoring
- Authentication analysis

### Harden
Techniques for reducing attack surface:
- Application hardening
- Credential hardening
- Platform hardening
- Communication hardening

### Isolate
Techniques for containing threats:
- Network isolation
- Execution isolation
- System configuration enforcement

### Deceive
Techniques for misleading adversaries:
- Credential decoys
- Network decoys
- File decoys

### Evict
Techniques for removing threats:
- Credential eviction
- Process termination
- File deletion
- Session termination

### Model
Techniques for characterizing normal behavior:
- Baseline modeling
- Pattern matching
- Anomaly detection

## Integration with ATT&CK

D3FEND complements ATT&CK by answering "How do we defend?" after ATT&CK answers "How do they attack?"

**ATT&CK Technique** → **D3FEND Countermeasure** → **Detection Rule**

Example:
- ATT&CK: T1003.001 (LSASS Memory Dumping)
- D3FEND: D3-PSA (Process Spawn Analysis), D3-PMA (Process Memory Analysis)
- Detection: Sigma rule monitoring process access to LSASS.exe

## Best Practices

### 1. Complete Import First
Always import ATT&CK data before D3FEND data to ensure mapping relationships work correctly.

### 2. Regular Updates
Re-run the import command periodically to get the latest D3FEND techniques and mappings:
```bash
python manage.py import_d3fend
```

The command uses `update_or_create` to safely update existing records without duplicating data.

### 3. Tactic-Based Organization
Organize detections by D3FEND tactic to identify gaps:
- Heavy on "Detect" but light on "Harden"? → Focus on preventive controls
- Good "Isolate" coverage? → Verify containment playbooks are ready

### 4. Multi-Technique Coverage
Map playbooks to multiple D3FEND techniques when applicable:
- A LSASS monitoring rule covers both Process Spawn Analysis and Process Memory Analysis
- This gives a complete picture of your defensive capabilities

### 5. Leverage Gap Analysis
Use gap analysis to prioritize detection development:
1. List your critical ATT&CK techniques
2. Run gap analysis on each
3. Sort by coverage percentage
4. Build detections for high-priority, low-coverage techniques

## Troubleshooting

### Import Fails with Connection Error
```
Failed to fetch ontology: ConnectionError
```

**Solution:** Check internet connectivity and firewall rules. D3FEND endpoints must be accessible.

### No Mappings Created
```
Imported 0 ATT&CK → D3FEND mappings (skipped 1247 unmatched)
```

**Solution:** Ensure ATT&CK data is imported first:
```bash
python manage.py import_mitre_universal
python manage.py import_d3fend
```

### Technique Not Found in Gap Analysis
```
{
  "data": {
    "d3fendGapAnalysis": null
  }
}
```

**Solution:** Verify the ATT&CK technique ID is correct and exists in the database.

## Technical Architecture

### Database Schema

```
D3fendDefensiveTechnique
├── d3fend_id (unique): "D3-PSA"
├── name: "Process Spawn Analysis"
├── definition: "Analyzing spawned processes..."
├── iri: "http://d3fend.mitre.org/ontologies/d3fend.owl#D3-PSA"
├── tactic: "Detect"
└── parent → D3fendDefensiveTechnique (self-referential)

D3fendDigitalArtifact
├── artifact_id (unique): "ProcessArtifact"
├── name: "Process"
├── definition: "An instance of a computer program..."
├── iri: "http://d3fend.mitre.org/ontologies/d3fend.owl#Process"
└── techniques → D3fendDefensiveTechnique (M2M)

D3fendAttackMapping
├── attack_technique → MitreAttackTechnique
├── d3fend_technique → D3fendDefensiveTechnique
└── relationship: "counters"
```

### JSON-LD Parsing

The D3FEND ontology uses JSON-LD format with `@graph` structure:

```json
{
  "@graph": [
    {
      "@id": "http://d3fend.mitre.org/ontologies/d3fend.owl#D3-PSA",
      "@type": ["owl:Class"],
      "rdfs:label": {"@value": "Process Spawn Analysis"},
      "d3fend:definition": {"@value": "..."},
      "rdfs:subClassOf": [{"@id": "http://d3fend.mitre.org/ontologies/d3fend.owl#Detect"}]
    }
  ]
}
```

The import command extracts:
- Defensive techniques (classes with `d3fend#` in IRI and D3- prefix)
- Digital artifacts (classes with `DigitalArtifact` in IRI)
- Hierarchical relationships (`rdfs:subClassOf`)
- Tactic classifications (parent class names)

## Future Enhancements

### Planned Features
- D3FEND Matrix visualization in frontend
- Interactive gap analysis dashboard
- Coverage heatmaps
- Detection recommendation engine
- SOAR integration for D3FEND response techniques

### API Expansion
- Mutations for manual D3FEND mapping management
- Bulk mapping operations
- Coverage reports and exports
- Integration with detection libraries

## References

- **D3FEND Project**: https://d3fend.mitre.org/
- **D3FEND Ontology**: https://d3fend.mitre.org/ontologies/d3fend.json
- **ATT&CK Mappings**: https://d3fend.mitre.org/api/ontology/inference/d3fend-full-mappings.csv
- **MITRE ATT&CK**: https://attack.mitre.org/

## Support

For issues with D3FEND integration:

1. Check the troubleshooting section above
2. Verify import logs for errors
3. Review GraphQL query syntax
4. Consult the D3FEND project documentation

## License

D3FEND data is provided by MITRE Corporation under the Apache License 2.0.
HEFAISTOS D3FEND integration is part of the HEFAISTOS platform.
