# AUTOCOMPLETE FOR SIGMA & KQL DETECTION RULES - IMPLEMENTATION PLAN

## Executive Summary
This document outlines a phased approach to add intelligent autocomplete functionality for SIGMA and KQL detection rules in the Detection Rule Editor Modal, enhancing user productivity and reducing syntax errors.

---

## 1. ARCHITECTURE OVERVIEW

### Visual Layout (UNCHANGED except for textarea → Monaco)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DETECTION RULE EDITOR MODAL                                        │
├─────────────────────────────────────────────────────────┬──────────┤
│  LEFT SIDEBAR (UNCHANGED)          │  RIGHT PANEL (UNCHANGED)      │
│  ┌──────────────────────────────┐  │  ┌────────────────────────┐   │
│  │ Templates Section ✅         │  │  │ [Editor][Preview]     │   │
│  │ - Quick Templates   ✅       │  │  │ [Suggestions][Similar]│   │
│  │ - Select & insert   ✅       │  │  │ ┌──────────────────┐  │   │
│  │                              │  │  │ │ MONACO EDITOR    │  │   │
│  │ Data Source Picker ✅        │  │  │ │ ← NEW (with      │  │   │
│  │ - Select source     ✅       │  │  │ │   autocomplete)  │  │   │
│  │                              │  │  │ │                  │  │   │
│  │ Load Existing Rule ✅        │  │  │ │ (old textarea    │  │   │
│  │ - Rule search       ✅       │  │  │ │  replaced here)  │  │   │
│  │ - Load into editor  ✅       │  │  │ └──────────────────┘  │   │
│  │                              │  │  │                       │   │
│  │ Edit Mode ✅                 │  │  │ Ctrl+Space ← Auto    │   │
│  │ - Manual            ✅       │  │  │ suggests keywords    │   │
│  │ - Logic             ✅       │  │  │ & fields             │   │
│  │ - AI                ✅       │  │  └────────────────────┘   │   │
│  │                              │  │                           │   │
│  │ AI Assist Buttons ✅         │  │  Format: SIGMA ✅        │   │
│  │ - Generate w/ AI   ✅        │  │  Mode: Manual ✅         │   │
│  │ - Suggest Improve  ✅        │  │  Chars: 245 ✅           │   │
│  │ - Generate Similar ✅        │  │  [Save] [Cancel] ✅      │   │
│  │                              │  │                           │   │
│  │ [Clear Content] ✅           │  │                           │   │
│  └──────────────────────────────┘  │                           │   │
└────────────────────────────────────┴───────────────────────────────┘

Legend:
✅ = Feature stays 100% the same
← = Autocomplete feature added here (ONLY)
```

### High-Level Flow:
```
User Types in Editor (Monaco)
    ↓
User presses Ctrl+Space OR types auto-trigger character
    ↓
Monaco autocomplete provider triggered
    ↓
Query Backend: getAutocompleteOptions()
    ↓
Backend returns filtered suggestions
    ↓
Monaco displays suggestions (↑↓ to navigate, Enter to select)
    ↓
User selects suggestion
    ↓
Monaco inserts with proper formatting
    ↓
User continues editing or uses other features (ALL UNCHANGED)
    ↓
All other buttons (AI, templates, etc.) work as before
```

---

## 2. FRONTEND CHANGES REQUIRED

### 2.0 Scope Clarification ⚠️ IMPORTANT
**Monaco Editor replaces ONLY the textarea component for code editing.**

**FEATURES THAT STAY EXACTLY THE SAME:**
✅ AI generation (Generate with AI button)
✅ Suggestions tab (AI improvement suggestions)
✅ Similar rules tab (Generate similar variations)
✅ Templates section (Quick templates dropdown)
✅ Data source picker (Link to data sources)
✅ Existing rule loader (Load rule from library)
✅ Format selector (SIGMA/KQL/WAZUH/OTHER)
✅ Mode selector (Manual/Logic/AI)
✅ Save functionality
✅ Modal layout and controls
✅ Preview tab
✅ All keyboard shortcuts
✅ All modals and side panels

**ONLY CHANGING:**
- The textarea for rule content input → Monaco Editor component
- Adding autocomplete provider to Monaco
- Adding SIGMA/KQL syntax highlighting to Monaco

### 2.1 New Dependencies
- **monaco-editor** (code editor only)
  - Replaces raw textarea
  - Adds syntax highlighting
  - Adds autocomplete support
  - Code folding, minimap, line numbers

- **@monaco-editor/react** (React wrapper)
  - Simpler integration with React
  - Handles Monaco initialization

### 2.2 Frontend Implementation

#### A. Component Enhancement - MINIMAL CHANGE
Replace this:
```tsx
<textarea
  value={ruleContent}
  onChange={(e) => setRuleContent(e.target.value)}
  className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-green-400 resize-none"
  placeholder={`# Enter your ${format} detection rule here...`}
  spellCheck={false}
/>
```

With this:
```tsx
<Editor
  height="100%"
  language={getLanguageForFormat(format)}
  value={ruleContent}
  onChange={(value) => setRuleContent(value || '')}
  theme="vs-dark"
  options={{
    minimap: { enabled: true },
    formatOnPaste: true,
    autoClosingBrackets: 'always',
    suggest: { maxVisibleSuggestions: 12 }
  }}
  beforeMount={(monaco) => {
    // Register custom languages
    // Register autocomplete provider
  }}
/>
```

**Everything else in the modal stays IDENTICAL:**
- Left sidebar with all pickers and selectors
- Right panel with tabs (editor, preview, suggestions, similar)
- Top header with format/mode selectors
- Bottom footer with character count
- AI Assist buttons
- Modal actions (Save, Cancel)

#### B. Autocomplete Trigger (Monaco Built-in)
Monaco automatically shows autocomplete:
1. When user presses `Ctrl+Space` (manual trigger)
2. After typing certain characters (auto-trigger)
3. Debouncing handled by Monaco automatically

#### C. Suggestion Display
Monaco's native UI handles display:
- Suggestion label
- Icon (autocomplete provider defines kind)
- Brief description
- Keyboard navigation (↑↓ arrows, Enter to select, Escape to close)

### 2.3 Files to Modify
- `frontend/src/components/DetectionRuleEditorModal.tsx`
  - Only the `<textarea>` → `<Editor>` replacement
  - Add beforeMount hook for autocomplete provider
  - Keep everything else unchanged

---

## 2.5 FEATURE PRESERVATION CHECKLIST

All existing Detection Rule Editor features must continue to work identically after Monaco Editor integration:

### Left Sidebar (Templates & Data Sources)
- [ ] Quick Templates dropdown - functional
- [ ] Template selection triggers content insertion
- [ ] Data Source Picker - fully functional
- [ ] Existing Rule Loader - functional
- [ ] Clear Content button - works
- [ ] Edit Mode selector (Manual/Logic/AI) - works

### Right Panel - Tabs
- [ ] **Editor Tab**: Monaco replaces textarea, all content preserved
- [ ] **Preview Tab**: Syntax highlighting still shows (enhanced by Monaco)
- [ ] **Suggestions Tab**: Still shows AI improvement suggestions
- [ ] **Similar Tab**: Still shows generated similar rules

### AI Assist Buttons
- [ ] **Generate with AI** - Loading state, success/error messages
- [ ] **Suggest Improvements** - Loads suggestions into Suggestions tab
- [ ] **Generate Similar** - Opens options panel, generates variations

### Header & Footer
- [ ] Format selector (SIGMA/KQL/WAZUH/OTHER) - works
- [ ] Mode badge display - works
- [ ] Character counter - still counts characters
- [ ] Save & Cancel buttons - functional

### Keyboard Shortcuts (NEW)
- [ ] Ctrl+Space - Open autocomplete
- [ ] ↑↓ arrows - Navigate suggestions
- [ ] Enter - Select suggestion
- [ ] Escape - Close autocomplete
- [ ] Tab - Accept suggestion and indent
- [ ] Ctrl+S - Save (if implemented)
- [ ] Ctrl+/ - Comment/uncomment (bonus)

### No Behavioral Changes
- [ ] Modal size and layout remains the same
- [ ] Modal animation/transitions unchanged
- [ ] Content state management identical
- [ ] Copy-paste behavior preserved
- [ ] Undo/redo functionality (Monaco provides this for free!)

---

### 3.1 New API Endpoint
Create GraphQL mutation for autocomplete suggestions:

```graphql
mutation GetAutocompleteOptions(
  $format: String!           # "SIGMA" | "KQL"
  $prefix: String!           # What user has typed
  $context: String!          # Full rule text for context
  $position: Int!            # Cursor position
  $dataSourceId: UUID        # Optional: filter by selected data source
) {
  getAutocompleteOptions(
    format: $format
    prefix: $prefix
    context: $context
    position: $position
    dataSourceId: $dataSourceId
  ) {
    suggestions {
      label: String!
      kind: String!           # "keyword" | "field" | "value" | "operator" | "function"
      documentation: String
      insertText: String      # What to actually insert
      detail: String          # Type or category
      sortText: String        # For sorting suggestions
    }
    isComplete: Boolean       # Whether more suggestions exist
  }
}
```

### 3.2 Backend Implementation

#### File Structure
```
backend/
├── rules/
│   ├── models.py            # (no changes)
│   ├── schema.py            # Add autocomplete mutation
│   ├── autocomplete/         # NEW FOLDER
│   │   ├── __init__.py
│   │   ├── base.py          # Base autocomplete engine
│   │   ├── sigma_engine.py   # SIGMA-specific logic
│   │   ├── kql_engine.py     # KQL-specific logic
│   │   └── suggestions.py    # Suggestion data models
```

#### A. SIGMA Autocomplete Engine (sigma_engine.py)

**Keywords to suggest:**
```
title, id, status, description, author, date, modified, logsource, detection, 
falsepositives, level, references, tags, condition, filter, selection, keywords
```

**Field suggestions** (based on selected data source):
- ProcessCreation: Image, CommandLine, ParentImage, User, etc.
- NetworkConnection: DestinationPort, DestinationIp, Protocol, etc.
- FileEvent: TargetFilename, FileVersion, Company, etc.
- DNS: QueryName, QueryResults, etc.

**Operators:**
```
| (pipe), endswith, contains, all, base64, all of, 1 of, near
```

**Values** (dynamic based on data source fields):
- Process names (cmd.exe, powershell.exe, explorer.exe, etc.)
- Common ports (80, 443, 445, 3389, etc.)
- File extensions (.exe, .dll, .ps1, .bat, etc.)

#### B. KQL Autocomplete Engine (kql_engine.py)

**Tables to suggest:**
```
DeviceProcessEvents, DeviceNetworkEvents, SigninLogs, 
DeviceFileEvents, AlertEvidence, AlertInfo, etc.
```

**Operators:**
```
where, project, extend, summarize, sort, limit, distinct, 
group by, join, union, has, contains, matches regex, in, between
```

**Functions:**
```
ago, now, totimespan, tostring, tonumber, strlen, 
strcat, split, extract, startswith, endswith, etc.
```

**Fields** (context-aware per table):
- DeviceProcessEvents: ProcessId, ProcessName, CommandLine, AccountName, etc.
- DeviceNetworkEvents: RemoteIP, RemotePort, Protocol, RemoteUrl, etc.

### 3.3 Database Additions (Optional but Recommended)

**New Tables for Performance Optimization:**

```sql
-- Cache SIGMA/KQL field mappings
CREATE TABLE rules_sigma_keywords (
    id UUID PRIMARY KEY,
    keyword VARCHAR(100),
    category VARCHAR(50),  -- keyword, operator, field, etc.
    documentation TEXT,
    created_at TIMESTAMP
);

CREATE TABLE rules_kql_tables (
    id UUID PRIMARY KEY,
    table_name VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP
);

CREATE TABLE rules_kql_fields (
    id UUID PRIMARY KEY,
    table_id UUID REFERENCES rules_kql_tables,
    field_name VARCHAR(100),
    field_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP
);

CREATE TABLE rules_field_mappings (
    id UUID PRIMARY KEY,
    data_source_id UUID REFERENCES data_catalog_datasource,
    sigma_field VARCHAR(100),
    kql_field VARCHAR(100),
    mapping_type VARCHAR(50),  -- direct, derived, unsupported
    created_at TIMESTAMP
);
```

---

## 4. DEPLOYMENT PHASES

### Phase 1: Foundation (Week 1)
- [ ] Create comprehensive test coverage
- [ ] Performance testing and optimization

---
### Phase 2: Frontend Integration (Week 2)
## 🚀 PHASE 1 IMPLEMENTATION COMPLETE
- [ ] Migrate from textarea to Monaco Editor
### ✅ Completed (January 9, 2026)
- [ ] Add autocomplete provider integration
**Backend Engine Created:**
- ✅ `backend/rules/autocomplete/base.py` - Base autocomplete engine (ABC class)
- ✅ `backend/rules/autocomplete/sigma_engine.py` - SIGMA-specific implementation (265 lines)
- ✅ `backend/rules/autocomplete/kql_engine.py` - KQL placeholder for Phase 2
- ✅ `backend/rules/autocomplete/suggestions.py` - Data models for suggestions
- ✅ `backend/rules/autocomplete/__init__.py` - Package init
- [ ] Create suggestion display UI
**GraphQL Integration:**
- ✅ `GetAutocompleteOptions` mutation in `backend/rules/schema.py`
- ✅ `AutocompleteResult` GraphQL type
- ✅ `AutocompleteSuggestion` GraphQL type
- ✅ Full error handling and graceful degradation
- [ ] Add keyboard navigation (arrow keys, enter to select)
**Database Schema:**
- ✅ `SigmaKeyword` model - Cache SIGMA keywords
- ✅ `KQLTable` model - Placeholder for KQL tables (Phase 2)
- ✅ `KQLField` model - Placeholder for KQL fields (Phase 2)
- ✅ `FieldMapping` model - Cross-format field mapping (Phase 2)
- ✅ `backend/rules/migrations/0013_autocomplete_caching.py` - Migration file
- [ ] Implement SIGMA language mode in Monaco
**Management Commands:**
- ✅ `populate_sigma_keywords` - Populates SIGMA keyword cache with 50+ keywords
- [ ] Implement KQL language mode in Monaco
**Testing:**
- ✅ Comprehensive test suite: `backend/rules/test_sigma_autocomplete.py`
  - Context analysis tests
  - Suggestion generation tests
  - YAML validation tests
  - Complete workflow tests
- ✅ All Python files pass syntax validation
- **Deployment decision point**: A/B test with small user group
### SIGMA Features Implemented:

**Keyword Suggestions** (13 root-level):
- title, id, status, description, author, date, modified, logsource, detection, falsepositives, level, references, tags

**Logsource Support:**
- Category suggestions (22 categories)
- Product suggestions (14 products)
- Service support

**Detection Section:**
- Selection/filter/condition keywords
- Detection condition keywords (all, of, 1 of, 2 of, etc.)

**Status & Level Values:**
- Status: experimental, test, stable, unsupported, deprecated
- Level: critical, high, medium, low, informational

**SIGMA Operators:**
- Basic: all, of, and, or, not
- String: endswith, contains, startswith, substr, re
- Advanced: cidr, base64, windash, cmdline, null

**Process Fields:**
- Image, CommandLine, ParentImage, User, ProcessId, etc.

**Network Fields:**
- DestinationPort, DestinationIp, SourceIp, Protocol, etc.

**File Fields:**
- TargetFilename, FileVersion, Company, Signed, etc.

**Registry Fields:**
- TargetObject, Details, EventType, Image, etc.

**DNS Fields:**
- QueryName, QueryResults, QueryStatus, Image, ProcessId

### Ready for Deployment:
1. Run migrations: `python manage.py migrate rules 0013`
2. Populate keywords: `python manage.py populate_sigma_keywords`
3. Run tests: `python manage.py test rules.test_sigma_autocomplete`
4. Test GraphQL: Execute `getAutocompleteOptions` mutation with test data

---
### Phase 3: Advanced Features (Week 3)
- [ ] Add field mapping based on selected data source
- [ ] Implement smart context analysis (what fields are valid here?)
- [ ] Add bracket/quote auto-completion
- [ ] Add code snippets for common patterns
- [ ] Performance optimization (caching, debouncing)
- **Deployment decision point**: Full production rollout

### Phase 4: Polish & Enhancement (Week 4)
- [ ] User feedback integration
- [ ] Performance tuning
- [ ] Documentation & help tooltips
- [ ] Accessibility improvements
- [ ] Analytics on autocomplete usage

---

## 5. DETAILED IMPLEMENTATION REQUIREMENTS

### 5.1 Frontend - Monaco Editor Setup

```typescript
// Example integration in DetectionRuleEditorModal.tsx
import { Editor } from '@monaco-editor/react';

<Editor
  height="100%"
  language={getLanguageForFormat(format)} // "sigma-yaml" | "kql"
  value={ruleContent}
  onChange={setRuleContent}
  options={{
    minimap: { enabled: true },
    formatOnPaste: true,
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    suggest: {
      showSnippets: true,
      showWords: true,
      maxVisibleSuggestions: 12,
    }
  }}
  beforeMount={(monaco) => {
    // Register language
    // Register autocomplete provider
    // Register theme
  }}
  onMount={(editor, monaco) => {
    // Setup autocomplete logic here
  }}
/>
```

### 5.2 Backend - Suggestion Engine

```python
# backend/rules/autocomplete/base.py

class AutocompleteEngine:
    """Base engine for all format-specific implementations"""
    
    def analyze_context(self, text: str, position: int) -> Dict:
        """Determine what context user is typing in"""
        pass
    
    def get_suggestions(self, prefix: str, context: Dict) -> List[Suggestion]:
        """Return suggestions based on prefix and context"""
        pass
    
    def rank_suggestions(self, suggestions: List[Suggestion]) -> List[Suggestion]:
        """Rank suggestions by relevance"""
        pass

class SigmaAutocompleteEngine(AutocompleteEngine):
    """SIGMA-specific autocomplete logic"""
    
    SIGMA_KEYWORDS = [...]
    SIGMA_OPERATORS = [...]
    
    def analyze_context(self, text: str, position: int) -> Dict:
        # Determine if we're in:
        # - detection section
        # - logsource section
        # - selection clause
        # etc.
        pass

class KQLAutocompleteEngine(AutocompleteEngine):
    """KQL-specific autocomplete logic"""
    
    KQL_TABLES = [...]
    KQL_FUNCTIONS = [...]
    pass
```

---

## 6. PERFORMANCE CONSIDERATIONS

### 6.1 Optimization Strategies
1. **Caching Layer**
   - Cache suggestion lists in Redis
   - Cache compiled suggestion indexes
   - TTL: 24 hours

2. **Debouncing**
   - Frontend: Debounce API calls while user types (300ms delay)
   - Only call backend after user pauses or triggers explicitly

3. **Result Filtering**
   - Server-side filtering by prefix reduces response size
   - Max 20 suggestions returned
   - Use relevance ranking to show best matches first

4. **Lazy Loading**
   - Load full documentation only when user hovers over suggestion
   - Load examples on-demand

---

## 7. USER CONSENT & ROLLOUT STRATEGY

### 7.1 Feature Flags
```python
# backend/core/settings.py
FEATURES = {
    'autocomplete_sigma': os.getenv('FEATURE_AUTOCOMPLETE_SIGMA', False),
    'autocomplete_kql': os.getenv('FEATURE_AUTOCOMPLETE_KQL', False),
    'autocomplete_advanced': os.getenv('FEATURE_AUTOCOMPLETE_ADVANCED', False),
}
```

### 7.2 Rollout Plan

**Phase A: Internal Testing (Week 1-2)**
- [ ] QA team tests with staging environment
- [ ] Performance benchmarking
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [ ] Create internal feedback survey

**Phase B: Beta Group (Week 3)**
- [ ] Selected 10-20 users opt-in to beta
- [ ] Email communication explaining feature
- [ ] Feedback collection form
- [ ] Daily monitoring of API performance
- [ ] Consent checkbox: "I agree to participate in Hefaistos beta features"

**Phase C: General Availability (Week 4+)**
- [ ] Full rollout to all users
- [ ] In-app notification: "New: Autocomplete in Detection Rules (Ctrl+Space)"
- [ ] Help documentation with screenshots
- [ ] Settings option to disable if users prefer

### 7.3 User Consent Mechanisms

**1. First-Time Modal**
```
┌─────────────────────────────────────┐
│  🚀 New Feature: Autocomplete      │
│                                     │
│  Detection rules now have           │
│  intelligent autocomplete!          │
│                                     │
│  ☑ Don't show again                │
│  [Cancel]  [Enable Autocomplete]   │
└─────────────────────────────────────┘
```

**2. Settings Toggle**
- Profile > Settings > Editor > Enable Autocomplete

**3. Usage Analytics Consent**
- "Help improve suggestions by reporting usage" (opt-in)
- Track which suggestions are selected vs. ignored
- Anonymous: user ID + suggestion ID + timestamp only

---

## 8. TESTING STRATEGY

### 8.1 Backend Tests
```python
# test_sigma_autocomplete.py
def test_sigma_keywords_in_detection_section():
    """Verify SIGMA keywords appear when user is in detection:"""
    
def test_sigma_fields_based_on_datasource():
    """Verify field suggestions change based on selected data source"""
    
def test_suggestion_ranking():
    """Verify most relevant suggestions appear first"""
```

### 8.2 Frontend Tests
```typescript
// test_autocomplete_integration.ts
describe('Detection Rule Editor Autocomplete', () => {
  it('should show SIGMA keywords when Ctrl+Space pressed', () => {});
  it('should filter KQL tables as user types', () => {});
  it('should insert suggestion with correct formatting', () => {});
  it('should handle nested YAML/KQL syntax correctly', () => {});
});

// test_feature_preservation.ts
describe('Detection Rule Editor - Feature Preservation', () => {
  // Verify all existing features still work
  it('should load templates and insert content', () => {});
  it('should generate AI suggestions', () => {});
  it('should show similar rules', () => {});
  it('should display syntax preview', () => {});
  it('should change format (SIGMA/KQL/etc)', () => {});
  it('should change mode (Manual/Logic/AI)', () => {});
  it('should display character count', () => {});
  it('should save rule with all features intact', () => {});
  it('should handle undo/redo (Monaco feature)', () => {});
  it('should preserve content during tab switching', () => {});
});
```

### 8.3 Performance Tests
- API response time < 200ms (p95)
- Frontend rendering < 100ms
- Memory usage increase < 5%

---

## 9. RESOURCE REQUIREMENTS

| Resource | Effort | Timeline |
|----------|--------|----------|
| Backend Engineer | 3-4 days | Week 1 |
| Frontend Engineer | 2-3 days | Week 2 |
| QA Engineer | 2 days | Week 3 |
| Product Manager | 1 day | Planning + Rollout |
| **Total** | **~2 weeks** | |

---

## 10. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API overload from autocomplete calls | High | Debouncing, caching, rate limiting |
| Incorrect suggestions confuse users | Medium | Thorough testing, feedback channel, disable toggle |
| Performance degradation | Medium | Lazy loading, pagination, benchmarking |
| Storage growth (suggestion cache) | Low | Database cleanup job, TTL policies |

---

## 11. ROLLBACK PLAN

If critical issues arise:
1. Set `FEATURE_AUTOCOMPLETE_*` flags to `False`
2. Frontend gracefully falls back to textarea
3. Database tables remain but unused
4. Users notified of temporary disable
5. Fix deployed within 24h

---

## 12. SUCCESS METRICS

After 1 month of rollout:
- **Adoption**: > 30% of users use autocomplete at least once
- **Error Reduction**: 15-20% decrease in SIGMA/KQL syntax errors
- **User Satisfaction**: > 4/5 stars in feedback survey
- **Performance**: API response time remains < 250ms p95
- **Support Tickets**: No new category of autocomplete-related issues

---

## NEXT STEPS & APPROVAL

### Before Development Starts:
1. **Technical Review**
   - [ ] Architect approval on database schema
   - [ ] Backend lead reviews API design
   - [ ] Frontend lead reviews Monaco Editor integration

2. **Product Review**
   - [ ] Product manager confirms requirements
   - [ ] UX lead reviews suggestion UI/UX
   - [ ] Documentation team prepares help content

3. **User Consent**
   - [ ] Legal review of analytics collection (if enabled)
   - [ ] Confirm beta group recruitment
   - [ ] Prepare user communication templates

### Sign-Off Required From:
- [ ] Technical Lead
- [ ] Product Manager
- [ ] QA Lead
- [ ] Security Officer (analytics)
- [ ] User Research (for beta group selection)

---

**Document Version**: 1.0  
**Date**: January 9, 2026  
**Status**: 🟡 **AWAITING APPROVAL**
