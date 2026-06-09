# Rule Format Conversion Feature - Implementation Plan

## 📋 Executive Summary

This document outlines the implementation of rule format conversion functionality in the HEFAISTOS platform using **direct pySigma library integration**. The feature allows users to convert detection rules between different formats (Sigma → Splunk, Elastic, QRadar, etc.) directly from:
1. **Rule Detail Page** - Convert individual rules from their detail view ✅ IMPLEMENTED
2. **Workbench Detail Page** - Convert rules within the rule editor modal ✅ IMPLEMENTED

**Key Approach:** All conversion happens in-process using the pySigma Python library, eliminating the need for external services.

---

## 🏗️ Architecture Overview

### Current HEFAISTOS Platform

**Frontend:**
- Framework: React 19 + TypeScript + Apollo Client + Ant Design
- Location: `frontend/` directory
- Deployment: Docker container (nginx reverse proxy)

**Backend:**
- Framework: Django 5.2 + GraphQL (Graphene)
- Database: PostgreSQL
- Message Queue: RabbitMQ
- Location: `backend/` directory
- Deployment: Docker container

**Supported Rule Formats:**
- SIGMA (native, convertible)
- KQL (native, not convertible)
- WAZUH (native, not convertible)
- OTHER (native, not convertible)

### pySigma Library

**What it is:**
- Python library for converting Sigma rules to multiple output formats
- Developed and maintained by Sigma HQ
- Free and open-source

**Key Features:**
- **30+ Backend Support:** Splunk, Elasticsearch, QRadar, Microsoft Defender, OpenSearch, Carbon Black, and more
- **In-Process Execution:** Runs entirely within the Python backend (no external service needed)
- **Minimal Dependencies:** Standard Python packages only
- **Auto-Discovery:** Automatically discovers installed backends at startup

**Backends Installed in HEFAISTOS:**
1. Splunk SPL (v1.0.3)
2. Elasticsearch (v1.0.7)
3. QRadar AQL (v0.3.3)
4. Microsoft Defender Advanced Hunting (v0.2.2)
5. OpenSearch (v1.0.2)
6. Carbon Black (v0.1.4)

**Performance:**
- First call: 1-2 seconds (backend plugin initialization)
- Subsequent calls: <100ms
- Memory overhead: <50MB per backend

---

## 📁 Implementation Files

### Backend Implementation

**1. File: `backend/rules/conversion.py` (New - ~250 lines)**

- Class: `SigmaConversionService` (singleton pattern)
- Methods:
  - `get_available_targets()` - Returns list of conversion backends
  - `get_formats_for_target(target)` - Returns formats for a backend
  - `convert_rule(sigma_yaml, target, format)` - Performs in-process conversion
  - `validate_sigma_yaml(yaml)` - Validates Sigma YAML syntax

**2. File: `backend/rules/schema.py` (Modified)**

- New GraphQL Types:
  - `ConversionTarget` - Backend platform info
  - `ConversionFormat` - Output format info
  - `ConvertedRule` - Conversion result
- New Queries:
  - `conversionTargets` - Get available backends
  - `conversionFormats(target)` - Get formats for backend
- New Mutation:
  - `convertDetectionRule(ruleId, target, format)` - Convert a rule
- Authentication: `@login_required` + organization-scoped access

**3. File: `backend/core/settings.py` (Modified)**

- Add pySigma configuration if needed
- Add logging configuration for conversions

### Frontend Implementation

**1. File: `frontend/src/graphql/conversion.ts` (New - ~95 lines)**

- Query: `GET_CONVERSION_TARGETS`
- Query: `GET_CONVERSION_FORMATS` (with target parameter)
- Mutation: `CONVERT_DETECTION_RULE`

**2. File: `frontend/src/components/RuleConversionModal.tsx` (New - ~314 lines)**

- React component for conversion UI
- Target & format selection dropdowns
- Syntax-highlighted result display
- Copy/download buttons
- Error handling & loading states

**3. File: `frontend/src/pages/RuleDetailPage.tsx` (Modified)**

- Add "Convert" button (blue with SwapOutlined icon)
- Add RuleConversionModal integration
- Button location: Action bar next to Edit/Copy buttons

**4. File: `frontend/src/pages/RuleDetailWorkbench.tsx` (Modified)**

- Add "Convert" button in editor toolbar
- Same modal integration as RuleDetailPage

---

## 🔌 Integration Points

### 1. Rule Detail Page Integration

- **Button Location:** Action toolbar
- **Trigger:** onClick → Open RuleConversionModal
- **Data:** Pass rule ID, name, format
- **Result:** Display converted rule in modal

### 2. Workbench Integration

- **Button Location:** Editor toolbar
- **Trigger:** onClick → Open RuleConversionModal
- **Data:** Pass current rule content/ID
- **Result:** Display converted rule in modal

### 3. GraphQL API Layer

- **Query:** `conversionTargets` → List available backends
- **Query:** `conversionFormats(target)` → Get formats for backend
- **Mutation:** `convertDetectionRule(ruleId, target, format)` → Convert rule
- **Security:** `@role_required` + organization filtering

---

## 🧪 Testing Strategy

### Unit Tests

**Backend (Python):**
- Test SigmaConversionService initialization
- Test get_available_targets() returns non-empty list
- Test convert_rule() with valid Sigma YAML
- Test error handling with invalid inputs

**Frontend (TypeScript):**
- Test RuleConversionModal renders correctly
- Test target/format selection
- Test conversion trigger & result display

### Integration Tests

- Test GraphQL queries return expected data
- Test GraphQL mutation converts rule successfully
- Test authentication/authorization

### E2E Tests

- User opens Rule Detail Page
- Clicks Convert button
- Selects target (Splunk)
- Clicks "Convert Now"
- Sees converted query
- Copies/downloads result

---

## 🔐 Security Considerations

1. **Authentication:** @login_required on all resolvers
2. **Authorization:** @role_required decorator
3. **Organization Scoping:** Filter rules by user.organization
4. **Input Validation:** Validate Sigma YAML before conversion
5. **Error Handling:** Don't expose internal errors to client
6. **Data Protection:** All data stays within backend process

---

## 📊 Implementation Timeline

**Week 1-2:** Core backend service + GraphQL API  
**Week 2:** Frontend modal component  
**Week 2-3:** Integration + testing + documentation  
**Week 3:** Deployment + UAT  

---

## 🎯 Success Criteria

- ✅ Users can convert Sigma rules from Rule Detail Page
- ✅ Users can convert Sigma rules from Workbench
- ✅ Conversion supports all 6 installed backends
- ✅ <100ms conversion time (after initial backend load)
- ✅ 80%+ test coverage
- ✅ Zero security vulnerabilities
- ✅ User-friendly error messages

---

**Document Version:** 1.1  
**Status:** ✅ CLEAN & ACCURATE - Direct pySigma Implementation  
**Last Updated:** 2026-02-01
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │ RuleDetailPage   │              │ PlaybookWorkbench│        │
│  │  - View Rule     │              │  - Edit Rule     │        │
│  │  - Convert Button│              │  - Convert Button│        │
│  └────────┬─────────┘              └─Workbench Detail │        │
│  │  - View Rule     │              │  - Rule Editor   │        │
│  │  - Convert Button│              │  - Convert Button│        │
│  └────────┬─────────┘              └────────┬─────────┘        │
│           │                                  │                   │
│           │    GraphQL Mutation: convertDetectionRule()         │
│           └──────────────┬───────────────────┘                  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HEFAISTOS Backend (Django)                    │
│                     Container: hefaistos-backend                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GraphQL Schema (rules/schema.py)                        │  │
<<<<<<< HEAD
│  │    - convertDetectionRule(ruleId, target, format, ...)   │  │
=======
│  │    - Mutation: convertDetectionRule(ruleId, target, ...) │  │
>>>>>>> a450b6e16c96e92e15575c31cf5187c8b1976ecc
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
<<<<<<< HEAD
│  │  Conversion Service (rules/conversion.py)                │  │
│  │    - SigmaConversionService (singleton pattern)          │  │
│  │    - validate_sigma_yaml()                               │  │
│  │    - get_available_targets()                             │  │
│  │    - convert_rule() → IN-PROCESS                         │  │
=======
│  │  Conversion Service (rules/conversion.py) [NEW]          │  │
│  │    - SigmaConversionService class                        │  │
│  │    - validate_sigma_rule()                               │  │
│  │    - get_available_targets()                             │  │
│  │    - get_formats_for_target()                            │  │
│  │    - convert_rule()                                      │  │
│  │    - Uses requests library for HTTP calls                │  │
>>>>>>> a450b6e16c96e92e15575c31cf5187c8b1976ecc
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │  pySigma Library (Direct Integration)                    │  │
│  │    - SigmaCollection.from_yaml()                         │  │
│  │    - Backend plugins (Splunk, Elastic, QRadar, etc.)     │  │
│  │    - backend.convert(rule, format)                       │  │
│  │    - Processing pipelines                                │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────┘
                          │
<<<<<<< HEAD
                          ▼
                  Converted Query String
             "index=security EventCode=4688 ..."
=======
                          │ HTTP POST (Internal Docker Network)
                          │ URL: http://sigconverter:8000/api/v1/latest/convert
                          │
┌─────────────────────────▼─────────────────────────────────────────┐
│              Sigconverter Service (Self-Hosted)                    │
│                 Container: hefaistos-sigconverter                  │
│                    Internal URL: http://sigconverter:8000          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Frontend Service (Port 8000)                              │   │
│  │  - Proxy requests to appropriate backend version          │   │
│  │  - Routes: /api/v1/<version>/targets, /convert, etc.     │   │
│  └───────────────────────┬───────────────────────────────────┘   │
│                          │                                         │
│  ┌───────────────────────▼───────────────────────────────────┐   │
│  │  Backend Service (Multiple versions, different ports)      │   │
│  │  - Built from pySigma library                             │   │
│  │  - Endpoints:                                             │   │
│  │    * POST /api/v1/convert - Convert Sigma rule            │   │
│  │    * GET  /api/v1/targets - List available backends       │   │
│  │    * GET  /api/v1/formats - List output formats           │   │
│  │    * GET  /api/v1/pipelines - List pipelines              │   │
│  │  - Supports 30+ conversion backends (Splunk, Elastic,     │   │
│  │    QRadar, Microsoft Defender, CrowdStrike, etc.)         │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

                  All communication via hefaistos-net Docker network
```
>>>>>>> a450b6e16c96e92e15575c31cf5187c8b1976ecc

## 🎯 Feature Requirements

### Functional Requirements

1. **Conversion Trigger Points:**
   - Rule Detail Page: "Convert" button next to Copy/Download buttons
   - Workbench Detail (Phase 2): "Convert Rule" action in rule editor modal

2. **User Workflow:**
   1. User clicks "Convert" button
   2. Modal opens with conversion options:
      - Select target platform (Splunk, (blue button with swap icon) ✅ IMPLEMENTED
   - Workbench Detail Page: "Convert" button in rule editor modal ✅ IMPLEMENTED

2. **User Workflow:**
   1. User clicks "Convert" button
   2. Modal opens (RuleConversionModal component) with conversion options:
      - Select target platform (Splunk, Elastic, QRadar, Microsoft Defender, etc.)
      - Select output format (if multiple formats available)
      - Select processing pipeline (optional)
   3. System validates input (must be SIGMA format)
<<<<<<< HEAD
   4. System converts rule using pySigma (in-process, <100ms)
=======
   4. System calls sigconverter API via internal Docker network
   5. System displays converted rule in modal with syntax highlighting
   6. User can:
      - Copy converted rule to clipboard
      - Download as file
      - Save to library (save converted rule as a new rule in HEFAISTOS)

>>>>>>> a450b6e16c96e92e15575c31cf5187c8b1976ecc
3. **Validation & Error Handling:**
   - Only SIGMA format rules can be converted (source format requirement)
   - Validate SIGMA YAML syntax before calling API
   - Handle API errors gracefully with user-friendly messages
   - Handle timeout/network errors
   - Display conversion warnings if any

### Non-Functional Requirements

1. **Performance:**
   - Conversion should complete within 5 seconds
   - No blocking of UI during conversion
   - Use loading indicators

2. **Security:**
   - Internal Docker network communication only
   - No external API calls
   - Authentication required for conversion (existing HEFAISTOS auth)
   - Input sanitization

3. **Maintainability:**
   - Code should be modular and testable
   - Follow existing HEFAISTOS code patterns
   - Comprehensive error logging

---

## 📁 File Changes Required

### Infrastructure Changes

#### 1. Modified: `docker-compose.yml`

Add sigconverter service to the Docker Compose stack:

```yaml
services:
  # ... existing services ...

  # --- SIGMA RULE CONVERTER ---
  # Self-hosted sigconverter.io for converting Sigma rules to various SIEM formats
  sigconverter:
    build:
      context: https://github.com/hefaistos-platform/sigconverter.io.git
      dockerfile: Dockerfile
    container_name: hefaistos-sigconverter
    ports:
      - "8100:8000"  # Expose for debugging if needed
    environment:
      - PORT=8000
    networks:
      - hefaistos-net
    restart: unless-stopped
```

Update backend service environment:

```yaml
  backend:
    # ... existing config ...
    environment:
      # ... existing vars ...
      - SIGCONVERTER_API_URL=http://sigconverter:8000/api/v1/latest
      - SIGCONVERTER_TIMEOUT=10
```

#### 2. Modified: `.env.template`

Add configuration for sigconverter:

```bash
# --- SIGMA RULE CONVERSION ---
# Self-hosted sigconverter.io service for converting Sigma rules to various SIEM formats
SIGCONVERTER_API_URL=http://sigconverter:8000/api/v1/latest
SIGCONVERTER_TIMEOUT=10
# Note: sigconverter service is automatically deployed via docker-compose
```

### Backend Changes

#### 1. New File: `backend/rules/conversion.py`

```python
"""
Rule format conversion service using self-hosted sigconverter.io.
"""
import base64
import logging
import requests
from typing import Dict, List, Optional, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)


class SigmaConversionService:
    """Service for converting Sigma rules to other formats using sigconverter.io."""
    
    def __init__(self):
        """Initialize the conversion service."""
        self.api_base_url = getattr(
            settings, 
            'SIGCONVERTER_API_URL', 
            'http://sigconverter:8000/api/v1/latest'
        )
        self.timeout = int(getattr(settings, 'SIGCONVERTER_TIMEOUT', 10))
    
    def get_available_targets(self) -> List[Dict[str, str]]:
        """
        Fetch list of available conversion targets (backends).
        
        Returns:
            List of dicts with 'name' and 'description' keys
            Example: [
                {"name": "splunk", "description": "Splunk SPL"},
                {"name": "elastic", "description": "Elastic EQL"},
                ...
            ]
        """
        try:
            url = f"{self.api_base_url}/targets"
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch conversion targets: {str(e)}")
            raise Exception(f"Unable to connect to conversion service: {str(e)}")
    
    def get_formats_for_target(self, target: str) -> List[Dict[str, str]]:
        """
        Fetch available output formats for a specific target.
        
        Args:
            target: Target backend name (e.g., 'splunk', 'elastic')
            
        Returns:
            List of dicts with 'name' and 'description' keys
            Example: [
                {"name": "default", "description": "Default format"},
                {"name": "rulename", "description": "Rule name only"},
                ...
            ]
        """
        try:
            url = f"{self.api_base_url}/formats"
            params = {"target": target}
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch formats for {target}: {str(e)}")
            raise Exception(f"Unable to fetch formats: {str(e)}")
    
    def get_available_pipelines(self, target: Optional[str] = None) -> List[Dict]:
        """
        Fetch available processing pipelines.
        
        Args:
            target: Optional target backend to filter pipelines
            
        Returns:
            List of dicts with 'name' and 'targets' keys
        """
        try:
            url = f"{self.api_base_url}/pipelines"
            params = {"target": target} if target else {}
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch pipelines: {str(e)}")
            return []  # Pipelines are optional, return empty list on error
    
    def convert_rule(
        self, 
        sigma_yaml: str, 
        target: str, 
        format: str = 'default',
        pipeline: Optional[List[str]] = None
    ) -> Tuple[bool, str]:
        """
        Convert Sigma rule to target format.
        
        Args:
            sigma_yaml: Sigma rule in YAML format
            target: Target backend (e.g., 'splunk', 'elastic')
            format: Output format (default: 'default')
            pipeline: Optional list of pipeline names to apply
            
        Returns:
            Tuple of (success: bool, result_or_error: str)
            On success: (True, converted_rule_string)
            On failure: (False, error_message_string)
        """
        try:
            # Validate input
            if not sigma_yaml or not sigma_yaml.strip():
                return False, "Empty rule content"
            
            # Base64 encode the rule
            rule_base64 = base64.b64encode(sigma_yaml.encode('utf-8')).decode('utf-8')
            
            # Prepare request payload
            payload = {
                "rule": rule_base64,
                "target": target,
                "format": format,
                "pipeline": pipeline or [],
                "pipelineYml": None  # Not using custom pipelines for now
            }
            
            # Call sigconverter API
            url = f"{self.api_base_url}/convert"
            logger.info(f"Converting rule to {target}/{format}")
            
            response = requests.post(
                url, 
                json=payload, 
                timeout=self.timeout
            )
            
            # Check response
            if response.status_code == 200:
                converted_rule = response.text
                logger.info(f"Conversion successful: {len(converted_rule)} chars")
                return True, converted_rule
            else:
                error_msg = response.text
                logger.error(f"Conversion failed: {response.status_code} - {error_msg}")
                return False, f"Conversion failed: {error_msg}"
                
        except requests.Timeout:
            error_msg = "Conversion timed out. The rule may be too complex or the service is overloaded."
            logger.error(error_msg)
            return False, error_msg
        except requests.RequestException as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def validate_sigma_yaml(self, yaml_content: str) -> Tuple[bool, str]:
        """
        Validate that the content is valid Sigma YAML.
        
        Args:
            yaml_content: YAML content to validate
            
        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        try:
            import yaml
            # Try to parse as YAML
            parsed = yaml.safe_load(yaml_content)
            
            # Check for basic Sigma structure
            if not isinstance(parsed, dict):
                return False, "Invalid YAML: must be a dictionary"
            
            # Check for required Sigma fields
            required_fields = ['title', 'detection']
            missing_fields = [field for field in required_fields if field not in parsed]
            
            if missing_fields:
                return False, f"Missing required Sigma fields: {', '.join(missing_fields)}"
            
            return True, ""
            
        except yaml.YAMLError as e:
            return False, f"Invalid YAML syntax: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}"
```

#### 2. Modified: `backend/rules/schema.py`

Add new GraphQL types, queries, and mutations:

```python
# Add to imports
from .conversion import SigmaConversionService

# Add new types
class ConversionTarget(graphene.ObjectType):
    """Available conversion target backend."""
    name = graphene.String()
    description = graphene.String()


class ConversionFormat(graphene.ObjectType):
    """Output format for a conversion target."""
    name = graphene.String()
    description = graphene.String()


class ConversionPipeline(graphene.ObjectType):
    """Processing pipeline for rule conversion."""
    name = graphene.String()
    targets = graphene.List(graphene.String)


class ConvertDetectionRulePayload(graphene.ObjectType):
    """Result of rule conversion."""
    success = graphene.Boolean(required=True)
    converted_rule = graphene.String()
    error_message = graphene.String()
    target_format = graphene.String()


class ConvertDetectionRule(graphene.Mutation):
    """
    Convert a Sigma detection rule to another format.
    """
    class Arguments:
        rule_id = graphene.ID(required=True, description="ID of the rule to convert")
        target = graphene.String(required=True, description="Target backend (e.g., 'splunk', 'elastic')")
        format = graphene.String(required=False, default_value="default", description="Output format")
        pipeline = graphene.List(graphene.String, required=False, description="Optional processing pipelines")
    
    Output = ConvertDetectionRulePayload
    
    @staticmethod
    def mutate(root, info, rule_id, target, format="default", pipeline=None):
        user = info.context.user
        if not user.is_authenticated:
            return ConvertDetectionRulePayload(
                success=False,
                error_message="Authentication required",
                target_format=f"{target}/{format}"
            )
        
        try:
            # Fetch the rule
            rule = DetectionRule.objects.get(
                id=rule_id,
                organization=user.organization
            )
            
            # Validate rule format
            if rule.format != 'SIGMA':
                return ConvertDetectionRulePayload(
                    success=False,
                    error_message="Only SIGMA format rules can be converted",
                    target_format=f"{target}/{format}"
                )
            
            # Get rule content
            rule_content = rule.raw_content
            if not rule_content:
                return ConvertDetectionRulePayload(
                    success=False,
                    error_message="Rule has no content",
                    target_format=f"{target}/{format}"
                )
            
            # Initialize conversion service
            converter = SigmaConversionService()
            
            # Validate Sigma YAML
            is_valid, validation_error = converter.validate_sigma_yaml(rule_content)
            if not is_valid:
                return ConvertDetectionRulePayload(
                    success=False,
                    error_message=f"Invalid Sigma rule: {validation_error}",
                    target_format=f"{target}/{format}"
                )
            
            # Convert rule
            success, result = converter.convert_rule(
                sigma_yaml=rule_content,
                target=target,
                format=format,
                pipeline=pipeline
            )
            
            if success:
                return ConvertDetectionRulePayload(
                    success=True,
                    converted_rule=result,
                    target_format=f"{target}/{format}"
                )
            else:
                return ConvertDetectionRulePayload(
                    success=False,
                    error_message=result,
                    target_format=f"{target}/{format}"
                )
                
        except DetectionRule.DoesNotExist:
            return ConvertDetectionRulePayload(
                success=False,
                error_message="Rule not found",
                target_format=f"{target}/{format}"
            )
        except Exception as e:
            return ConvertDetectionRulePayload(
                success=False,
                error_message=f"Internal error: {str(e)}",
                target_format=f"{target}/{format}"
            )


# Add to Query class
class Query(graphene.ObjectType):
    # ... existing queries ...
    
    conversion_targets = graphene.List(
        ConversionTarget,
        description="List available conversion target backends"
    )
    
    conversion_formats = graphene.List(
        ConversionFormat,
        target=graphene.String(required=False),
        description="List output formats, optionally filtered by target"
    )
    
    conversion_pipelines = graphene.List(
        ConversionPipeline,
        target=graphene.String(required=False),
        description="List processing pipelines, optionally filtered by target"
    )
    
    def resolve_conversion_targets(self, info):
        """Fetch available conversion targets."""
        user = info.context.user
        if not user.is_authenticated:
            return []
        
        try:
            converter = SigmaConversionService()
            targets = converter.get_available_targets()
            return [ConversionTarget(**target) for target in targets]
        except Exception as e:
            logger.error(f"Failed to fetch conversion targets: {str(e)}")
            return []
    
    def resolve_conversion_formats(self, info, target=None):
        """Fetch output formats for conversion targets."""
        user = info.context.user
        if not user.is_authenticated:
            return []
        
        try:
            converter = SigmaConversionService()
            if target:
                formats = converter.get_formats_for_target(target)
                return [ConversionFormat(**fmt) for fmt in formats]
            else:
                # If no target specified, return formats for all targets
                targets = converter.get_available_targets()
                all_formats = []
                for t in targets:
                    formats = converter.get_formats_for_target(t['name'])
                    all_formats.extend([ConversionFormat(**fmt) for fmt in formats])
                return all_formats
        except Exception as e:
            logger.error(f"Failed to fetch conversion formats: {str(e)}")
            return []
    
    def resolve_conversion_pipelines(self, info, target=None):
        """Fetch processing pipelines."""
        user = info.context.user
        if not user.is_authenticated:
            return []
        
        try:
            converter = SigmaConversionService()
            pipelines = converter.get_available_pipelines(target)
            return [ConversionPipeline(**pipeline) for pipeline in pipelines]
        except Exception as e:
            logger.error(f"Failed to fetch conversion pipelines: {str(e)}")
            return []


# Add to Mutation class
class Mutation(graphene.ObjectType):
    # ... existing mutations ...
    convert_detection_rule = ConvertDetectionRule.Field()
```

#### 3. Modified: `backend/core/settings.py`

Add configuration for sigconverter API:

```python
# Sigma Rule Conversion Settings
SIGCONVERTER_API_URL = os.environ.get(
    'SIGCONVERTER_API_URL', 
    'http://sigconverter:8000/api/v1/latest'
)
SIGCONVERTER_TIMEOUT = int(os.environ.get('SIGCONVERTER_TIMEOUT', '10'))
```

### Frontend Changes

#### 1. New File: `frontend/src/graphql/conversion.ts`

GraphQL queries and mutations:

```typescript
import { gql } from '@apollo/client';

export const GET_CONVERSION_TARGETS = gql`
  query GetConversionTargets {
    conversionTargets {
      name
      description
    }
  }
`;

export const GET_CONVERSION_FORMATS = gql`
  query GetConversionFormats($target: String) {
    conversionFormats(target: $target) {
      name
      description
    }
  }
`;

export const GET_CONVERSION_PIPELINES = gql`
  query GetConversionPipelines($target: String) {
    conversionPipelines(target: $target) {
      name
      targets
    }
  }
`;

export const CONVERT_DETECTION_RULE = gql`
  mutation ConvertDetectionRule(
    $ruleId: ID!
    $target: String!
    $format: String
    $pipeline: [String]
  ) {
    convertDetectionRule(
      ruleId: $ruleId
      target: $target
      format: $format
      pipeline: $pipeline
    ) {
      success
      convertedRule
      errorMessage
      targetFormat
    }
  }
`;
```

#### 2. New File: `frontend/src/components/RuleConversionModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, message, Alert, Space } from 'antd';
import { useMutation, useQuery } from '@apollo/client';
import { CopyOutlined, DownloadOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  GET_CONVERSION_TARGETS,
  GET_CONVERSION_FORMATS,
  CONVERT_DETECTION_RULE,
} from '../graphql/conversion';

interface RuleConversionModalProps {
  visible: boolean;
  ruleId: string;
  ruleName: string;
  originalFormat: string;
  onCancel: () => void;
}

export const RuleConversionModal: React.FC<RuleConversionModalProps> = ({
  visible,
  ruleId,
  ruleName,
  originalFormat,
  onCancel,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('default');
  const [convertedRule, setConvertedRule] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch available targets
  const { data: targetsData, loading: targetsLoading } = useQuery(GET_CONVERSION_TARGETS);

  // Fetch formats for selected target
  const { data: formatsData, loading: formatsLoading } = useQuery(GET_CONVERSION_FORMATS, {
    variables: { target: selectedTarget },
    skip: !selectedTarget,
  });

  // Convert mutation
  const [convertRule, { loading: converting }] = useMutation(CONVERT_DETECTION_RULE, {
    onCompleted: (data) => {
      if (data.convertDetectionRule.success) {
        setConvertedRule(data.convertDetectionRule.convertedRule);
        setErrorMessage('');
        message.success('Rule converted successfully!');
      } else {
        setErrorMessage(data.convertDetectionRule.errorMessage || 'Conversion failed');
        setConvertedRule('');
        message.error('Conversion failed');
      }
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setConvertedRule('');
      message.error('Conversion failed');
    },
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setSelectedTarget('');
      setSelectedFormat('default');
      setConvertedRule('');
      setErrorMessage('');
    }
  }, [visible]);

  // Reset format when target changes
  useEffect(() => {
    setSelectedFormat('default');
  }, [selectedTarget]);

  const handleConvert = async () => {
    if (!selectedTarget) {
      message.warning('Please select a target platform');
      return;
    }

    await convertRule({
      variables: {
        ruleId,
        target: selectedTarget,
        format: selectedFormat,
        pipeline: null,
      },
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(convertedRule);
      message.success('Copied to clipboard!');
    } catch (err) {
      message.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([convertedRule], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ruleName}-${selectedTarget}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Downloaded successfully!');
  };

  const handleSaveToLibrary = async () => {
    try {
      // Save the converted rule as a new rule in HEFAISTOS
      // This would call a GraphQL mutation to create a new DetectionRule
      await saveConvertedRule({
        variables: {
          title: `${ruleName} (${selectedTarget})`,
          content: convertedRule,
          format: selectedTarget.toUpperCase(),
          // ... other required fields
        }
      });
      message.success('Saved to library successfully!');
    } catch (err) {
      message.error('Failed to save to library');
    }
  };

  // Check if original format is SIGMA
  const isSigmaRule = originalFormat === 'SIGMA';

  return (
    <Modal
      title={`Convert Detection Rule: ${ruleName}`}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="close" onClick={onCancel}>
          Close
        </Button>,
      ]}
    >
      {!isSigmaRule && (
        <Alert
          message="Only Sigma format rules can be converted"
          description={`This rule is in ${originalFormat} format. Please convert it to Sigma format first.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isSigmaRule && (
        <>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Target Platform Selection */}
            <div>
              <label>Target Platform:</label>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select target platform (e.g., Splunk, Elastic)"
                loading={targetsLoading}
                value={selectedTarget || undefined}
                onChange={setSelectedTarget}
                showSearch
                optionFilterProp="children"
              >
                {targetsData?.conversionTargets?.map((target: any) => (
                  <Select.Option key={target.name} value={target.name}>
                    {target.description} ({target.name})
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* Output Format Selection */}
            {selectedTarget && (
              <div>
                <label>Output Format:</label>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Select output format"
                  loading={formatsLoading}
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                >
                  {formatsData?.conversionFormats?.map((format: any) => (
                    <Select.Option key={format.name} value={format.name}>
                      {format.description} ({format.name})
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}

            {/* Convert Button */}
            <Button
              type="primary"
              onClick={handleConvert}
              loading={converting}
              disabled={!selectedTarget}
              icon={<ReloadOutlined />}
              block
            >
              Convert Now
            </Button>

            {/* Error Message */}
            {errorMessage && (
              <Alert
                message="Conversion Error"
                description={errorMessage}
                type="error"
                showIcon
                closable
                onClose={() => setErrorMessage('')}
              />
            )}

            {/* Converted Rule Display */}
            {convertedRule && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Converted Rule ({selectedTarget}/{selectedFormat}):</strong>
                </div>
                <SyntaxHighlighter
                  language="sql"
                  style={oneDark}
                  customStyle={{
                    maxHeight: 400,
                    borderRadius: 4,
                  }}
                >
                  {convertedRule}
                </SyntaxHighlighter>
                
                <Space style={{ marginTop: 12 }}>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopy}
                  >
                    Copy to Clipboard
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                  >
                    Download
                  </Button>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={handleSaveToLibrary}
                    type="primary"
                  >
                    Save to Library
                  </Button>
                </Space>
              </div>
            )}
          </Space>
        </>
      )}
    </Modal>
  );
};
```

#### 3. Modified: `frontend/src/pages/RuleDetailPage.tsx`

Add conversion button and modal (example integration):

```typescript
import { RuleConversionModal } from '../components/RuleConversionModal';
import { SwapOutlined } from '@ant-design/icons';

export const RuleDetailPage = () => {
  const [conversionModalVisible, setConversionModalVisible] = useState(false);
  
  // ... existing code ...
  
  return (
    <div>
      {/* ... existing UI ... */}
      
      {/* Action Buttons */}
      <Space>
        <Button 
          type="primary" 
          icon={<SwapOutlined />} 
          onClick={() => setConversionModalVisible(true)}
          disabled={rule.format !== 'SIGMA'}
        >
          Convert
        </Button>
        {/* ... existing buttons (Copy, Download, Edit) ... */}
      </Space>
      
      {/* Conversion Modal */}
      <RuleConversionModal
        visible={conversionModalVisible}
        ruleId={rule.id}
        ruleName={rule.title}
        originalFormat={rule.format}
        onCancel={() => setConversionModalVisible(false)}
      />
      
      {/* ... rest of the page ... */}
    </div>
  );
};
```

---

## 🔄 Implementation Phases

### Phase 1: Infrastructure Setup (Day 1)
**Priority: HIGH**

- [x] Update docker-compose.yml to add sigconverter service
- [x] Update .env.template with sigconverter configuration
- [ ] Build and start sigconverter service
- [ ] Verify sigconverter is accessible from backend container
- [ ] Test API endpoints manually (curl from backend container)

**Acceptance Criteria:**
- Sigconverter service builds and starts successfully
- Backend can reach http://sigconverter:8000/api/v1/latest/targets
- API returns list of available backends
- No errors in sigconverter logs

### Phase 2: Backend Implementation (Day 2-3)
**Priority: HIGH**

- [ ] Create `backend/rules/conversion.py` service class
- [ ] Add settings in `backend/core/settings.py`
- [ ] Implement API client methods:
  - `get_available_targets()`
  - `get_formats_for_target()`
  - `get_available_pipelines()`
  - `convert_rule()`
  - `validate_sigma_yaml()`
- [ ] Add error handling and logging
- [ ] Write unit tests for conversion service

**Acceptance Criteria:**
- Can fetch available targets from sigconverter
- Can convert a sample Sigma rule to Splunk format
- Proper error handling for invalid inputs
- All tests pass

### Phase 3: GraphQL API Layer (Day 3-4)
**Priority: HIGH**

- [ ] Add GraphQL types in `rules/schema.py`
- [ ] Add query resolvers: `conversion_targets`, `conversion_formats`, `conversion_pipelines`
- [ ] Add mutation: `ConvertDetectionRule`
- [ ] Add authentication/authorization checks
- [ ] Test GraphQL endpoints via GraphiQL
- [ ] Write integration tests

**Acceptance Criteria:**
- Can query available targets via GraphQL
- Can trigger conversion via mutation
- Returns proper error messages
- Only authenticated users can convert

### Phase 4: Frontend UI Components (Day 4-6)
**Priority: HIGH**

- [ ] Create GraphQL query/mutation file: `frontend/src/graphql/conversion.ts`
- [ ] Create `RuleConversionModal` component
- [ ] Implement target/format selection UI
- [ ] Add loading states and error handling
- [ ] Integrate syntax highlighting for results
- [ ] Add copy/download functionality
- [ ] Update `RuleDetailPage` with Convert button
- [ ] Wire up modal

**Acceptance Criteria:**
- Modal opens and displays available targets
- Conversion executes and displays results
- User can copy/download converted rule
- UI is responsive and intuitive
- Error messages are user-friendly

### Phase 5: Testing & Documentation (Day 6-7)
**Priority: MEDIUM**

- [ ] End-to-end testing of full workflow
- [ ] Test with various Sigma rule samples
- [ ] Test error scenarios (invalid YAML, API timeout, etc.)
- [ ] Cross-browser testing
- [ ] Performance testing (large rules)
- [ ] Update user documentation
- [ ] Create demo video/screenshots

**Acceptance Criteria:**
- All user workflows tested and working
- No console errors
- Proper error handling for edge cases
- Documentation updated

### Phase 6: Optional Enhancements (Day 8+)
**Priority: LOW**

- [ ] Add conversion history tracking (database model)
- [ ] Add "Save as New Rule" option
- [ ] Add to PlaybookWorkbench
- [ ] Add batch conversion for multiple rules
- [ ] Add custom pipeline configuration UI
- [ ] Add analytics tracking for popular conversions
- [ ] Add caching for targets/formats

---

## 🧪 Testing Strategy

### Unit Tests

**Backend Python Tests:**
```python
# backend/rules/tests/test_conversion.py

import pytest
from unittest.mock import Mock, patch
from rules.conversion import SigmaConversionService

class TestSigmaConversionService:
    
    def test_get_available_targets(self):
        """Test fetching conversion targets."""
        service = SigmaConversionService()
        with patch('requests.get') as mock_get:
            mock_get.return_value.json.return_value = [
                {"name": "splunk", "description": "Splunk SPL"}
            ]
            targets = service.get_available_targets()
            assert len(targets) == 1
            assert targets[0]['name'] == 'splunk'
    
    def test_convert_sigma_to_splunk_success(self):
        """Test successful Sigma to Splunk conversion."""
        service = SigmaConversionService()
        sigma_rule = """
title: Test Rule
detection:
  selection:
    EventID: 4688
  condition: selection
        """
        with patch('requests.post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.text = 'EventID=4688'
            success, result = service.convert_rule(sigma_rule, 'splunk')
            assert success
            assert 'EventID' in result
    
    def test_convert_invalid_yaml(self):
        """Test error handling for invalid YAML."""
        service = SigmaConversionService()
        invalid_yaml = "invalid: yaml: content:"
        is_valid, error = service.validate_sigma_yaml(invalid_yaml)
        assert not is_valid
    
    def test_api_timeout(self):
        """Test timeout handling."""
        service = SigmaConversionService()
        with patch('requests.post') as mock_post:
            mock_post.side_effect = requests.Timeout()
            success, error = service.convert_rule("rule", "splunk")
            assert not success
            assert 'timeout' in error.lower()
```

**Frontend TypeScript Tests:**
```typescript
// frontend/src/components/__tests__/RuleConversionModal.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { RuleConversionModal } from '../RuleConversionModal';
import { GET_CONVERSION_TARGETS, CONVERT_DETECTION_RULE } from '../../graphql/conversion';

describe('RuleConversionModal', () => {
  it('renders target selection', async () => {
    const mocks = [
      {
        request: { query: GET_CONVERSION_TARGETS },
        result: {
          data: {
            conversionTargets: [
              { name: 'splunk', description: 'Splunk SPL' }
            ]
          }
        }
      }
    ];
    
    render(
      <MockedProvider mocks={mocks}>
        <RuleConversionModal
          visible={true}
          ruleId="1"
          ruleName="Test"
          originalFormat="SIGMA"
          onCancel={() => {}}
        />
      </MockedProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Target Platform/i)).toBeInTheDocument();
    });
  });
  
  it('handles conversion success', async () => {
    // ... test implementation
  });
  
  it('displays error message on failure', async () => {
    // ... test implementation
  });
});
```

### Integration Tests

1. **GraphQL Endpoint Test:**
   - Query `conversionTargets` returns list
   - Query `conversionFormats` with target filter works
   - Mutation `convertDetectionRule` converts rule successfully

2. **Full Stack Test:**
   - Backend → Sigconverter API communication
   - Error handling propagation
   - Timeout handling

### Manual Testing Checklist

- [ ] Start HEFAISTOS with sigconverter service
- [ ] Verify sigconverter container is running
- [ ] Navigate to Rule Detail Page
- [ ] Click "Convert" button on a Sigma rule
- [ ] Verify modal opens with target list
- [ ] Select Splunk as target
- [ ] Click "Convert Now"
- [ ] Verify converted rule appears
- [ ] Copy to clipboard and verify
- [ ] Download file and verify
- [ ] Save to library and verify rule appears in Rule Hub
- [ ] Test with non-Sigma rule (should show warning)
- [ ] Test with invalid Sigma YAML
- [ ] Test network error (stop sigconverter)

---

## 🚨 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sigconverter service startup time | MEDIUM | Add health check, show loading state in UI |
| Sigconverter memory usage | MEDIUM | Monitor resource usage, set memory limits in docker-compose |
| Complex rules fail conversion | MEDIUM | Validate before conversion, show detailed errors |
| Network issues between containers | LOW | Use Docker network, add retry logic |
| Port conflicts | LOW | Use non-standard port 8100, make configurable |

---

## 📊 Success Metrics

1. **Technical Success:**
   - Sigconverter service starts within 30 seconds
   - Conversion completes in < 5 seconds (90th percentile)
   - Error rate < 5%
   - Zero security vulnerabilities

2. **User Success:**
   - Users can convert rules without documentation
   - Error messages are actionable
   - Feature used by 30%+ of active users within first month
   - < 5 support tickets related to conversion

---

## 📚 References

- [Sigconverter.io Repository](https://github.com/hefaistos-platform/sigconverter.io)
- [pySigma Documentation](https://github.com/SigmaHQ/pySigma)
- [Sigma Rule Specification](https://github.com/SigmaHQ/sigma-specification)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

**Document Version:** 2.0 (CORRECTED)  
**Last Updated:** 2026-02-01  
**Status:** CORRECTED - READY FOR IMPLEMENTATION  
**Key Change:** Self-hosted sigconverter.io instead of external API
