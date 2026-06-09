# Revised Suggestions: Maieutic Engine Enhancement for WorkbenchDetail Integration

## 🔍 Critical Context: WorkbenchDetail Integration

The Maieutic Engine output is **exported directly into WorkbenchDetail**, which means:

1. **Output format must be WorkbenchDetail-compatible**
2. **DCG420 fields should map to existing Playbook fields**
3. **Graph visualization should enhance, not replace, existing UI**
4. **State management must preserve WorkbenchDetail workflow**

---

## 🎯 PRIORITY 1: WorkbenchDetail-Aware Enhancements

### 1. Enhanced Maieutic Output Schema for Playbook Integration

**Current Integration Point:** `MaieuticEngineModal` → Submit → Populate WorkbenchDetail fields

**Suggested Enhancement:**
```python
# backend/ai_assistant/engine.py

def run_maieutic_questioning(user_settings, user_input, conversation_history=None, current_step='hypothesis'):
    """Enhanced to return WorkbenchDetail-ready output."""
    
    # ... existing logic ...
    
    # After AI response, extract structured data for workbench
    workbench_export = {
        # Core fields
        'title': extract_detection_title(conversation_history),
        'goal': extract_goal(conversation_history, user_input),
        'technical_context': extract_technical_context(conversation_history),
        
        # MITRE mapping
        'mitre_technique_id': extract_mitre_id(conversation_history + [user_input]),
        
        # Detection logic
        'detection_strategy': infer_strategy(conversation_history),
        'detection_rule': None,  # Generated later via GenerateSigmaAI
        
        # Robustness (DCG420 → Playbook field mapping)
        'robustness_level': robustness_recommendation.get('level', 1),
        'data_source_maturity': robustness_recommendation.get('source_type', 'Application'),
        
        # Playbooks (from 'playbook' step)
        'response_playbook': extract_manual_playbook(conversation_history),
        'automation_notes': extract_soar_playbook(conversation_history),
        
        # Validation
        'false_positives': extract_false_positives(conversation_history),
        'blind_spots': extract_blind_spots(conversation_history),
        'test_recommendations': extract_atomic_tests(conversation_history),
        
        # Metadata
        'conversation_history': conversation_history,  # For audit trail
        'completed_steps': get_completed_steps(conversation_history)
    }
    
    return (
        _normalize_ai_json(response.text),
        provider,
        workbench_export  # NEW: Return export data
    )

def extract_detection_title(conversation_history):
    """Generate title from hypothesis."""
    for entry in reversed(conversation_history):
        user_text = entry.get('user', '')
        if re.search(r'T\d{4}', user_text):
            # Extract technique-based title
            return f"Detect {user_text[:100]}"
    return "Untitled Detection"

def extract_technical_context(conversation_history):
    """Aggregate all technical details from interrogation step."""
    context_parts = []
    for entry in conversation_history:
        ai_text = entry.get('ai', '')
        # Look for technical prompts (Event IDs, APIs, etc.)
        if 'Event ID' in ai_text or 'API' in ai_text or 'mechanism' in ai_text.lower():
            context_parts.append(entry.get('user', ''))
    return "\n\n".join(context_parts)

def extract_blind_spots(conversation_history):
    """Extract mentioned evasion techniques."""
    blind_spots = []
    for entry in conversation_history:
        ai_text = entry.get('ai', '')
        if 'evade' in ai_text.lower() or 'bypass' in ai_text.lower() or 'blind spot' in ai_text.lower():
            # Extract the specific evasion mentioned
            blind_spots.append(ai_text)
    return "\n---\n".join(blind_spots) if blind_spots else "None identified during conversation"
```

**GraphQL Schema Update:**
```python
# backend/ai_assistant/schema.py

class MaieuticWorkbenchExport(graphene.ObjectType):
    """Structured data ready for WorkbenchDetail import."""
    title = graphene.String()
    goal = graphene.String()
    technical_context = graphene.String()
    mitre_technique_id = graphene.String()
    detection_strategy = graphene.String()
    robustness_level = graphene.Int()
    data_source_maturity = graphene.String()
    response_playbook = graphene.String()
    automation_notes = graphene.String()
    false_positives = graphene.String()
    blind_spots = graphene.String()
    test_recommendations = graphene.List(graphene.String)
    conversation_history = graphene.JSONString()

class MaieuticQuestion(graphene.Mutation):
    ai_response = graphene.JSONString()
    provider_used = graphene.String()
    workbench_export = graphene.Field(MaieuticWorkbenchExport)  # NEW
    
    def mutate(self, info, user_input, conversation_history=None, current_step='hypothesis'):
        # ... existing logic ...
        
        response_text, provider, export_data = run_maieutic_questioning(
            settings, user_input, conversation_history, current_step or 'hypothesis'
        )
        
        response_json = json.loads(response_text)
        
        return MaieuticQuestion(
            ai_response=response_json,
            provider_used=provider,
            workbench_export=MaieuticWorkbenchExport(**export_data)
        )
```

**Frontend Integration:**
```typescript
// frontend/src/components/maieutic/MaieuticEngineModal.tsx

const handleSubmitToWorkbench = async () => {
  // Aggregate all conversation turns
  const fullConversation = conversationHistory;
  
  // Final query to get export data
  const { data } = await maieuticQuestion({
    variables: {
      userInput: "Generate final export",
      conversationHistory: fullConversation,
      currentStep: 'review'
    }
  });
  
  const exportData = data.maieuticQuestion.workbenchExport;
  
  // Call onImport prop with structured data
  onImport({
    title: exportData.title,
    goal: exportData.goal,
    technical_context: exportData.technicalContext,
    mitre_technique_id: exportData.mitreTechniqueId,
    // ... map all fields
  });
  
  onClose();
};
```

**Impact:** Seamless integration - Maieutic output populates WorkbenchDetail fields without manual copying

---

### 2. XState Integration That Preserves WorkbenchDetail Flow

**Key Insight:** XState manages Maieutic workflow internally; export still triggers standard WorkbenchDetail save.

**Suggested Approach:**
```typescript
// frontend/src/machines/detectionLifecycleMachine.ts

const detectionMachine = setup({
  // ... actors, guards ...
}).createMachine({
  id: 'maieuticEngine',
  initial: 'hypothesis',
  context: {
    // Mirrors WorkbenchDetail fields
    title: '',
    goal: '',
    technicalContext: '',
    mitreTechniqueId: null,
    robustnessLevel: 1,
    responsePlaybook: '',
    blindSpots: '',
    conversationHistory: []
  },
  states: {
    hypothesis: { /* ... */ },
    interrogation: { /* ... */ },
    robustness: { /* ... */ },
    playbook: { /* ... */ },
    review: {
      on: {
        EXPORT_TO_WORKBENCH: {
          target: 'exporting',
          actions: assign({
            // Finalize all context fields for export
          })
        }
      }
    },
    exporting: {
      invoke: {
        src: async ({ context }) => {
          // Return data in WorkbenchDetail format
          return {
            title: context.title || generateTitle(context.conversationHistory),
            goal: context.goal,
            technical_context: context.technicalContext,
            mitre_technique_id: context.mitreTechniqueId,
            robustness_level: context.robustnessLevel,
            response_playbook: context.responsePlaybook,
            blind_spots: context.blindSpots,
            // ... all fields
          };
        },
        onDone: {
          target: 'complete',
          actions: (_, event) => {
            // Trigger parent callback with export data
            onExportComplete?.(event.output);
          }
        }
      }
    },
    complete: {
      type: 'final'
    }
  }
});

// Usage in MaieuticEngineModal
export const MaieuticEngineModal = ({ onImport, onClose }) => {
  const [state, send] = useMachine(detectionMachine, {
    actions: {
      onExportComplete: (context, event) => {
        // Pass structured data to WorkbenchDetail
        onImport(event.output);
        onClose();
      }
    }
  });
  
  return (
    <Modal>
      {/* Render based on state.matches() */}
      {state.matches('review') && (
        <Button onClick={() => send({ type: 'EXPORT_TO_WORKBENCH' })}>
          Submit to Workbench
        </Button>
      )}
    </Modal>
  );
};
```

**Impact:** Rigorous workflow internally, clean export externally.

---

### 3. React Flow as Supplemental Visualization (Not Replacement)

**Key Insight:** Don't replace WorkbenchDetail UI; add visual summary panel.

**Suggested Approach:**
```typescript
// frontend/src/components/maieutic/MaieuticGraph.tsx

export const MaieuticGraph = ({ conversationHistory, compact = false }) => {
  const [nodes, edges] = useMemo(() => 
    buildGraphFromConversation(conversationHistory),
    [conversationHistory]
  );
  
  if (compact) {
    // Thumbnail view for WorkbenchDetail
    return (
      <div className="h-32 border rounded">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodesDraggable={false}
          zoomOnScroll={false}
          panOnScroll={false}
        />
      </div>
    );
  }
  
  // Full view in Maieutic modal
  return (
    <div className="h-96">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ threat: ThreatNode, evidence: EvidenceNode }}
      />
    </div>
  );
};

// In WorkbenchDetail
export const WorkbenchDetail = ({ playbook }) => {
  return (
    <div>
      {/* Existing fields */}
      <Input label="Title" value={playbook.title} />
      <Textarea label="Goal" value={playbook.goal} />
      
      {/* NEW: Visual summary if came from Maieutic */}
      {playbook.conversationHistory && (
        <div className="my-4">
          <h3 className="text-sm font-semibold mb-2">Detection Logic Summary</h3>
          <MaieuticGraph 
            conversationHistory={playbook.conversationHistory}
            compact={true}
          />
        </div>
      )}
      
      {/* Rest of form */}
    </div>
  );
};
```

**Impact:** Visual context without disrupting existing workflow.

---

### 4. Robustness Score as Playbook Metadata Field

**Backend:**
```python
# backend/playbooks/models.py

class PlaybookGraph(models.Model):
    # ... existing fields ...
    
    # NEW: DCG420-inspired fields
    robustness_level = models.IntegerField(
        null=True, blank=True,
        choices=[
            (1, 'Level 1: Ephemeral (Hash/IP-based)'),
            (2, 'Level 2: Weak (Tool name)'),
            (3, 'Level 3: Moderate (Behavior with gaps)'),
            (4, 'Level 4: Strong (Invariant TTP)'),
            (5, 'Level 5: Invariant (OS/Protocol mechanism)')
        ],
        help_text="Pyramid of Pain robustness score from Maieutic Engine"
    )
    
    data_source_maturity = models.CharField(
        max_length=20, 
        null=True, blank=True,
        choices=[
            ('Application', 'Application-level logs'),
            ('User-Mode', 'User-mode hooks'),
            ('Kernel-Mode', 'Kernel-mode telemetry')
        ]
    )
    
    blind_spots = models.TextField(
        blank=True,
        help_text="Known evasion techniques or detection gaps"
    )
    
    conversation_history = models.JSONField(
        null=True, blank=True,
        help_text="Maieutic conversation that generated this detection"
    )
    
    test_validation_status = models.CharField(
        max_length=20,
        null=True, blank=True,
        choices=[
            ('NOT_TESTED', 'Not tested'),
            ('PASSED', 'Atomic Red Team test passed'),
            ('FAILED', 'Test failed - needs refinement'),
            ('MANUAL', 'Manually validated')
        ]
    )
```

**GraphQL Schema:**
```python
# backend/playbooks/schema.py

class PlaybookGraphType(DjangoObjectType):
    class Meta:
        model = PlaybookGraph
    
    robustness_level = graphene.Int()
    data_source_maturity = graphene.String()
    blind_spots = graphene.String()
    test_validation_status = graphene.String()
    
    # Computed field
    robustness_label = graphene.String()
    
    def resolve_robustness_label(self, info):
        if not self.robustness_level:
            return None
        labels = {
            1: "🔴 Ephemeral",
            2: "🟠 Weak",
            3: "🟡 Moderate",
            4: "🟢 Strong",
            5: "🔵 Invariant"
        }
        return labels.get(self.robustness_level)
```

**Frontend Display:**
```typescript
// frontend/src/components/workbench/WorkbenchDetail.tsx

export const WorkbenchDetail = ({ playbook }) => {
  return (
    <div>
      {/* Existing fields */}
      
      {/* NEW: Robustness indicator */}
      {playbook.robustnessLevel && (
        <div className="bg-blue-50 p-4 rounded-lg my-4">
          <h3 className="font-semibold mb-2">Detection Engineering Quality</h3>
          
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm text-gray-600">Robustness Level</label>
              <div className="flex items-center gap-2 mt-1">
                <PyramidIcon level={playbook.robustnessLevel} />
                <span className="font-bold">{playbook.robustnessLabel}</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-600">Data Source</label>
              <div className="mt-1">{playbook.dataSourceMaturity}</div>
            </div>
            
            {playbook.testValidationStatus === 'PASSED' && (
              <div className="ml-auto">
                <Badge color="green">
                  ✓ Atomic Red Team Validated
                </Badge>
              </div>
            )}
          </div>
          
          {playbook.blindSpots && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">
                Known Blind Spots & Evasion Techniques
              </summary>
              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {playbook.blindSpots}
              </div>
            </details>
          )}
        </div>
      )}
      
      {/* View conversation history */}
      {playbook.conversationHistory && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            View Maieutic Conversation
          </summary>
          <div className="mt-2 text-sm font-mono max-h-64 overflow-y-auto">
             {/* ... */}
          </div>
        </details>
      )}
      
      {/* Rest of form */}
    </div>
  );
};
```

**Impact:** WorkbenchDetail displays detection quality metrics; full audit trail preserved.

---

## 🎯 PRIORITY 2: WorkbenchDetail-Integrated Validation

### 5. Atomic Red Team Testing from WorkbenchDetail

**Suggested Approach:**
```typescript
// Add "Test Detection" button in WorkbenchDetail

export const WorkbenchDetail = ({ playbook, onUpdate }) => {
  const [testResult, setTestResult] = useState(null);
  
  const handleRunTest = async () => {
    const { data } = await client.mutate({
      mutation: GET_ATOMIC_TEST,
      variables: { techniqueId: playbook.mitreTechnique?.techniqueId }
    });
    
    // Show test plan to user
    setTestResult(data.getAtomicTest.testPlan);
  };
  
  const handleRecordTestResult = async (triggered: boolean) => {
    await client.mutate({
      mutation: RECORD_TEST_RESULT,
      variables: {
        detectionId: playbook.id,
        techniqueId: playbook.mitreTechnique?.techniqueId,
        triggered
      }
    });
    
    // Update playbook status
    onUpdate({
      ...playbook,
      testValidationStatus: triggered ? 'PASSED' : 'FAILED'
    });
  };
  
  return (
    <div>
      {/* Existing fields */}
      
      {/* NEW: Testing section */}
      {playbook.mitreTechnique && (
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">Validation Testing</h3>
          
          {!testResult ? (
            <Button onClick={handleRunTest}>
              Get Atomic Red Team Test for {playbook.mitreTechnique.techniqueId}
            </Button>
          ) : (
            <div>
              <h4 className="font-medium">Test Plan:</h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                {testResult.tests[0]?.command}
              </pre>
              
              <div className="mt-3 flex gap-2">
                <Button onClick={() => handleRecordTestResult(true)} color="green">
                  ✓ Test Passed (Alert Triggered)
                </Button>
                <Button onClick={() => handleRecordTestResult(false)} color="red">
                  ✗ Test Failed (No Alert)
                </Button>
              </div>
            </div>
          )}
          
          {playbook.testValidationStatus === 'FAILED' && (
            <Alert color="red" className="mt-2">
              Detection failed testing. Consider returning to Maieutic Engine to refine logic.
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};
```

**Impact:** Close the loop - test from WorkbenchDetail, return to Maieutic if fails.

---

### 6. Data Availability Check Before Rule Generation

**Integration Point:** When clicking "Generate Detection Rule" in WorkbenchDetail

```typescript
// frontend/src/components/workbench/WorkbenchDetail.tsx

const handleGenerateRule = async () => {
  // STEP 1: Validate data sources (NEW)
  const requiredSources = extractDataSources(playbook.technicalContext);
  
  const { data: validation } = await client.mutate({
    mutation: VALIDATE_DATA_AVAILABILITY,
    variables: { dataSources: requiredSources }
  });
  
  if (!validation.validateDataAvailability.available) {
    // Show warning
    const missing = validation.validateDataAvailability.missingSources;
    const proceed = await confirm(
      `Warning: Missing data sources: ${missing.join(', ')}. ` +
      `This detection may not work in your environment. Proceed anyway?`
    );
    
    if (!proceed) {
      return;
    }
  }
  
  // STEP 2: Generate rule (existing)
  const { data } = await generateSigmaAI({
    variables: {
      playbookId: playbook.id,
      outputFormat: selectedFormat
    }
  });
  
  setSigmaRule(data.generateSigmaAi.sigmaRule);
};

function extractDataSources(technicalContext: string): string[] {
  const sources = [];
  if (/Event (?:ID )?(\d{4})/.test(technicalContext)) {
    sources.push('Windows Security Logs');
  }
  if (/Sysmon/.test(technicalContext)) {
    sources.push('Sysmon');
  }
  if (/PowerShell/.test(technicalContext)) {
    sources.push('PowerShell Script Block Logging');
  }
  // ... more heuristics
  return sources;
}
```

**Backend:**
```python
# backend/ai_assistant/schema.py

class ValidateDataAvailability(graphene.Mutation):
    class Arguments:
        data_sources = graphene.List(graphene.String)
    
    available = graphene.Boolean()
    missing_sources = graphene.List(graphene.String)
    coverage_percentage = graphene.Float()
    
    def mutate(self, info, data_sources):
        from data_catalog.models import DataSource
        
        missing = []
        available_count = 0
        
        for source in data_sources:
            # Check if data source exists and is active
            exists = DataSource.objects.filter(
                Q(name__icontains=source) | Q(description__icontains=source),
                organization=info.context.user.organization,
                status='ACTIVE'
            ).exists()
            
            if exists:
                available_count += 1
            else:
                missing.append(source)
        
        coverage = (available_count / len(data_sources) * 100) if data_sources else 0
        
        return ValidateDataAvailability(
            available=len(missing) == 0,
            missing_sources=missing,
            coverage_percentage=coverage
        )
```

**Impact:** Prevents "Detection Debt" - warns before generating unusable rules.

---

## 📊 PRIORITY 3: WorkbenchDetail Analytics Integration

### 7. Detection Quality Dashboard in WorkbenchDetail List View

```typescript
// frontend/src/components/workbench/WorkbenchList.tsx

export const WorkbenchList = ({ playbooks }) => {
  const stats = useMemo(() => ({
    avgRobustness: calculateAverage(playbooks, 'robustnessLevel'),
    testedCount: playbooks.filter(p => p.testValidationStatus === 'PASSED').length,
    maieuticGenerated: playbooks.filter(p => p.conversationHistory).length
  }), [playbooks]);
  
  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard 
          label="Avg Robustness" 
          value={stats.avgRobustness.toFixed(1)} 
          icon={<PyramidIcon />}
        />
        <StatCard 
          label="Validated Detections" 
          value={`${stats.testedCount}/${playbooks.length}`}
          icon={<CheckIcon />}
        />
        <StatCard 
          label="Maieutic Engineered" 
          value={stats.maieuticGenerated}
          icon={<BrainIcon />}
        />
      </div>
      
      {/* Playbook table with robustness column */}
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>MITRE</th>
            <th>Robustness</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {playbooks.map(p => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.mitreTechnique?.techniqueId}</td>
              <td>
                {p.robustnessLevel ? (
                  <RobustnessBadge level={p.robustnessLevel} />
                ) : (
                  <span className="text-gray-400">Not assessed</span>
                )}
              </td>
              <td>
                {p.testValidationStatus === 'PASSED' && (
                  <Badge color="green">✓ Tested</Badge>
                )}
              </td>
              <td>
                <Button onClick={() => openWorkbenchDetail(p)}>Edit</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};
```

**Impact:** Quality metrics visible at glance; prioritize low-robustness detections for refinement.

---

## 🔄 PRIORITY 4: Bi-Directional Workflow

### 8. "Refine with Maieutic" Button in WorkbenchDetail

**Use Case:** User has existing detection that needs improvement.

```typescript
// frontend/src/components/workbench/WorkbenchDetail.tsx

export const WorkbenchDetail = ({ playbook }) => {
  const [showMaieutic, setShowMaieutic] = useState(false);
  
  const handleRefineWithMaieutic = () => {
    // Pre-populate Maieutic with existing detection context
    const initialContext = {
      hypothesis: playbook.goal || playbook.title,
      existingRule: playbook.detectionRule,
      knownFalsePositives: playbook.falsePositives,
      currentStep: 'robustness'  // Start at robustness assessment
    };
    
    setShowMaieutic(true);
  };
  
  return (
    <div>
      {/* Existing fields */}
      
      {/* NEW: Refinement suggestion */}
      {shouldSuggestRefinement(playbook) && (
        <Alert color="yellow" className="my-4">
          <div className="flex items-center justify-between">
            <span>
              This detection could be improved. Robustness: {playbook.robustnessLabel}
            </span>
            <Button onClick={handleRefineWithMaieutic}>
              Refine with Maieutic Engine
            </Button>
          </div>
        </Alert>
      )}
      
      {showMaieutic && (
        <MaieuticEngineModal
          isOpen={showMaieutic}
          onClose={() => setShowMaieutic(false)}
          onImport={(updatedData) => {
            // Merge updated data back into playbook
            onUpdate({ ...playbook, ...updatedData });
            setShowMaieutic(false);
          }}
          initialContext={initialContext}
        />
      )}
    </div>
  );
};

function shouldSuggestRefinement(playbook) {
  return (
    playbook.robustnessLevel && playbook.robustnessLevel < 3 ||
    playbook.testValidationStatus === 'FAILED' ||
    !playbook.conversationHistory  // Not Maieutic-generated
  );
}
```

**Impact:** Continuous improvement loop; legacy detections can be enhanced.

---

## 🎯 QUICK WINS FOR WORKBENCH INTEGRATION (This Week)

1. **Add Conversation History to Playbook Model**
   ```bash
   python manage.py makemigrations playbooks --name add_maieutic_fields
   ```

2. **Update Maieutic Export to Map All Fields**
   - In `run_maieutic_questioning()`, return export dict matching `PlaybookGraph` fields.

3. **Display Robustness Badge in WorkbenchDetail**
   - Use standardized Pyramid of Pain colors.

4. **Add "View Conversation" Collapsible Section**
   - Simple JSON/Text viewer for audit trail.

---

## 📋 REVISED IMPLEMENTATION PLAN (WorkbenchDetail-Centric)

### Phase 1: Seamless Export (Week 1-2)
1. ✅ Add `workbench_export` to `MaieuticQuestion` response
2. ✅ Update `PlaybookGraph` model with DCG420 fields
3. ✅ Map Maieutic output to WorkbenchDetail fields
4. ✅ Display robustness level in WorkbenchDetail

**Outcome:** Maieutic → WorkbenchDetail is one-click, no manual copying

### Phase 2: Quality Indicators (Week 3-4)
5. ✅ Display robustness badge in list view
6. ✅ Add "Blind Spots" collapsible section
7. ✅ Show validation status (tested/not tested)
8. ✅ Add conversation history viewer

**Outcome:** WorkbenchDetail shows detection quality at glance

### Phase 3: Validation Loop (Week 5-6)
9. ✅ Data availability check before rule generation
10. ✅ Atomic Red Team integration in WorkbenchDetail
11. ✅ "Refine with Maieutic" button for failed tests

**Outcome:** Closed-loop testing and refinement

### Phase 4: Visualization (Week 7-8)
12. ✅ React Flow thumbnail in WorkbenchDetail
13. ✅ Full graph in Maieutic modal
14. ✅ Graph export to WorkbenchDetail metadata

**Outcome:** Visual logic summary without disrupting UI

### Phase 5: Advanced (Week 9-12)
15. ✅ XState (internal to Maieutic, transparent to WorkbenchDetail)
16. ✅ Analytics dashboard in list view
17. ✅ MITRE coverage heat map

**Outcome:** Full vision realized, WorkbenchDetail enhanced

---

## 🎖️ KEY DESIGN PRINCIPLES

1. **WorkbenchDetail remains source of truth** - Maieutic is an authoring tool.
2. **Backward compatible** - Existing playbooks work; new fields are optional.
3. **Progressive enhancement** - Features add value without breaking existing workflow.
4. **Export-first design** - Maieutic produces WorkbenchDetail-ready data.
5. **Visual supplements, doesn't replace** - Graph enhances, doesn't change UI.
