# HEFAISTOS Platform - Open Questions Answers

## 1. ✅ Zustand is Available - Single Monolithic Store

**Confirmed:** Zustand `^5.0.8` is installed in `frontend/package.json`.

**Location:** `frontend/src/useStore.ts`

**Current Implementation:**
- **Single store** with monolithic design (not sliced)
- Manages the playbook graph node selection state:
  ```tsx
  interface AppState {
    selectedNode: AbstractionNodeData | null;
    setSelectedNode: (nodeData: AbstractionNodeData | null) => void;
  }
  
  export const useAppStore = create<AppState>((set) => ({
    selectedNode: null,
    setSelectedNode: (nodeData) => set({ selectedNode: nodeData }),
  }));
  ```

**Pattern Observed:**
- Very minimal store - only tracks selected node
- Rest of state is React `useState` (local component state)
- No slice pattern currently used

**Recommendation for MaieuticOutput import state:**
- You have two options:
  1. **Add to Zustand store** (preferred for cross-component access)
  2. **Keep as local useState** (if only used in modal/single component)

---

## 2. ✅ Custom Modal Primitive (NOT Headless UI)

**Confirmed:** HEFAISTOS uses a **custom Modal component**, not Headless UI.

**Location:** `frontend/src/components/ui/Modal.tsx`

**Implementation Details:**
```tsx
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // Fixed overlay with z-50
  // Tailwind classes: border-hefaistos-border, custom styling
  // Click-outside-to-close pattern
  // SVG close button
}
```

**Key Features:**
- Custom-styled with Tailwind CSS
- Uses `hefaistos-border` custom class
- Simple overlay + content box pattern
- No external component library dependencies

**How it's Used:**
- `InviteUserModal` uses `<Modal isOpen={isOpen} onClose={onClose} title="..." />`
- `GraphBuilderModal` imports `{ Modal } from '../ui/Modal'`

**Recommendation:**
- **Follow this pattern** for your import modal
- Use the existing custom `Modal` component
- Maintain consistency with other HEFAISTOS modals

---

## 3. ⚠️ Workbench Data Shape - Playbook Detection/Rule Fields

**Confirmed Structure from `PlaybookWorkbench.tsx`:**

### Main Playbook Graph Type:
```tsx
query GetPlaybookGraph($id: UUID!) {
  playbookGraph(id: $id) {
    // Core Fields
    id, title, status, tags, isShared
    
    // Detection/Strategy Related
    mitreTechnique { id, techniqueId, name }
    selectedStrategy      // JSONString (strategy configuration)
    detectionRule         // String (rule content)
    goal                  // String
    technicalContext      // String
    blindSpots            // String
    triageGuidance        // String
    falsePositives        // String
    responsePlaybook      // String
    targetFilePath        // String
    testScenario          // String
    testExpectedOutput    // String
    
    // SOAR Configuration
    alertTrigger
    defaultSeverity
    enrichmentSteps
    containmentSteps
    notificationSteps
    
    // Metadata
    customId, version
    author { id, username }
    robustnessLevel, dataSourceRobustness
    createdAt
    
    // Graph Nodes (Abstractions)
    nodes {
      id, layerName, positionX, positionY
      templateData (JSON)
      mitreAttackMappings { id, techniqueId, name }
    }
    edges { id, source, target }
  }
}
```

### Detection/Rule Specific Fields:
- `detectionRule`: The actual rule content (string)
- `selectedStrategy`: Strategy configuration (JSONString)
- `mitreTechnique`: Linked MITRE technique
- `triageGuidance`, `falsePositives`: Detection-specific text fields

### Detection Template Data (`Dcg420DetectionTemplate`):
```tsx
export interface Dcg420DetectionTemplate {
  goal?: string;
  categorization?: {
    mitreAttackTactic?: string;
    mitreAttackTechnique?: string;
  };
  strategyAbstract?: string;
  technicalContext?: string;
  blindSpotsAndAssumptions?: string;
  falsePositives?: string;
  validation?: {
    description?: string;
    testReference?: string;
  };
  priority?: string;
  response?: string;  // Maps to triageGuidance
  detectionRule?: {
    format?: string;
    rule?: string;
  };
  acdElements?: {
    engageID?: string;
    description?: string;
  }[];
}
```

---

## 4. ⚠️ Partial Import vs. Full Import - NEEDS CLARIFICATION

**Current Implementation:**
- `ExportImportModal.tsx` exports/imports **entire playbook graph**
- Uses `exportPlaybookGraph` and `importPlaybookGraph` mutations
- No checkbox-based partial import seen in codebase

**Export/Import Mutations:**
```tsx
mutation ImportPlaybookGraph($importData: JSONString!, $newTitle: String) {
  importPlaybookGraph(importData: $importData, newTitle: $newTitle) {
    success
    graph { id title }
    message
  }
}
```

**What Would Partial Import Require:**
1. Checkbox UI for each section (detection rules, SOAR config, nodes, etc.)
2. Backend mutation parameter to specify which sections to import
3. Conflict resolution logic (update vs. skip vs. merge)

**Recommendation - Ask Backend Team:**
- **Does the backend support partial imports?** (Currently appears to be all-or-nothing)
- **Conflict strategy:** If importing into existing playbook:
  - Overwrite entire section?
  - Merge with existing?
  - Skip if exists?
  - Ask user per-section?

**Suggested UI Design (if partial import needed):**
```tsx
const [importSections, setImportSections] = useState({
  detectionRules: true,
  soarConfig: true,
  nodes: true,
  metadata: false,  // title, tags, etc.
});
```

---

## Summary

| Question | Answer | Status |
|----------|--------|--------|
| **Zustand** | Single monolithic store at `frontend/src/useStore.ts` | ✅ Confirmed |
| **Modal Primitive** | Custom component at `frontend/src/components/ui/Modal.tsx` | ✅ Confirmed |
| **Workbench Data Shape** | Graph structure with detection/rule fields documented above | ✅ Confirmed |
| **Partial Import** | Not implemented; backend needs clarification | ⚠️ Needs Spec |

