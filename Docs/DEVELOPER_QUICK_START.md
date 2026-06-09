# Sigconverter.io Integration - Developer Quick Start

## 🎯 What Was Fixed

The original plan assumed sigconverter.io had a public API. **It doesn't.** This PR fixes that by setting up self-hosted deployment.

## 🚀 Current Status

✅ **Infrastructure:** Ready (docker-compose.yml updated)  
✅ **Documentation:** Complete (all files rewritten)  
⏳ **Backend Code:** Not started (waiting for you!)  
⏳ **Frontend Code:** Not started (waiting for you!)  

## 📖 Read This First

1. **Start here:** [Docs/SIGCONVERTER_FIX_SUMMARY.md](./SIGCONVERTER_FIX_SUMMARY.md)
   - Quick explanation of what was wrong and how it was fixed

2. **Then read:** [Docs/RULE_CONVERSION_PLAN.md](./RULE_CONVERSION_PLAN.md)
   - Complete implementation plan with code examples
   - Follow this to build the backend and frontend

3. **Quick reference:** [Docs/RULE_CONVERSION_SUMMARY.md](./RULE_CONVERSION_SUMMARY.md)
   - Code snippets and API examples

## 🏗️ Architecture

```
┌────────────────────────────┐
│ HEFAISTOS Frontend         │
│  - React + TypeScript      │
│  - RuleDetailPage          │
│  - RuleConversionModal     │
└──────────┬─────────────────┘
           │ GraphQL
           ▼
┌────────────────────────────┐
│ HEFAISTOS Backend          │
│  - Django + GraphQL        │
│  - SigmaConversionService  │
└──────────┬─────────────────┘
           │ HTTP POST
           │ http://sigconverter:8000/api/v1/latest/convert
           ▼
┌────────────────────────────┐
│ Sigconverter Service       │
│  - Flask + pySigma         │
│  - 30+ SIEM backends       │
│  - Docker container        │
└────────────────────────────┘
```

## ⚡ Quick Test

Test that sigconverter works:

```bash
# Build the service
docker compose build sigconverter

# Start it
docker compose up -d sigconverter

# Wait for it to start (check logs)
docker logs -f hefaistos-sigconverter

# Test API (from backend container)
docker exec hefaistos-backend curl http://sigconverter:8000/api/v1/latest/targets

# Or from host (debug port)
curl http://localhost:8100/api/v1/latest/targets
```

Expected response:
```json
[
  {"name": "splunk", "description": "Splunk SPL"},
  {"name": "elastic", "description": "Elastic EQL"},
  ...
]
```

## 💻 Implementation Steps

### Phase 1: Backend (Week 1)

#### 1. Create Conversion Service

**File:** `backend/rules/conversion.py`

```python
import base64
import requests
from django.conf import settings

class SigmaConversionService:
    def __init__(self):
        self.api_base_url = settings.SIGCONVERTER_API_URL
        self.timeout = settings.SIGCONVERTER_TIMEOUT
    
    def get_available_targets(self):
        """Fetch available conversion backends"""
        response = requests.get(f"{self.api_base_url}/targets", timeout=self.timeout)
        return response.json()
    
    def convert_rule(self, sigma_yaml, target, format='default'):
        """Convert Sigma rule to target format"""
        rule_base64 = base64.b64encode(sigma_yaml.encode()).decode()
        payload = {
            "rule": rule_base64,
            "target": target,
            "format": format,
            "pipeline": [],
            "pipelineYml": None
        }
        response = requests.post(f"{self.api_base_url}/convert", json=payload, timeout=self.timeout)
        if response.status_code == 200:
            return True, response.text
        else:
            return False, response.text
```

#### 2. Update GraphQL Schema

**File:** `backend/rules/schema.py`

Add these types and mutations (see RULE_CONVERSION_PLAN.md for full code):
- `ConversionTarget` type
- `ConversionFormat` type
- `ConvertDetectionRule` mutation
- Queries for targets and formats

#### 3. Add Settings

**File:** `backend/core/settings.py`

```python
# Sigma Rule Conversion
SIGCONVERTER_API_URL = os.environ.get('SIGCONVERTER_API_URL', 'http://sigconverter:8000/api/v1/latest')
SIGCONVERTER_TIMEOUT = int(os.environ.get('SIGCONVERTER_TIMEOUT', '10'))
```

### Phase 2: Frontend (Week 2)

#### 1. Create GraphQL Queries

**File:** `frontend/src/graphql/conversion.ts`

```typescript
export const GET_CONVERSION_TARGETS = gql`
  query GetConversionTargets {
    conversionTargets {
      name
      description
    }
  }
`;

export const CONVERT_DETECTION_RULE = gql`
  mutation ConvertDetectionRule($ruleId: ID!, $target: String!, $format: String) {
    convertDetectionRule(ruleId: $ruleId, target: $target, format: $format) {
      success
      convertedRule
      errorMessage
    }
  }
`;
```

#### 2. Create Modal Component

**File:** `frontend/src/components/RuleConversionModal.tsx`

See RULE_CONVERSION_PLAN.md for full implementation.

#### 3. Update RuleDetailPage

Add Convert button and wire up the modal.

## 🧪 Testing

### Unit Tests

```bash
# Backend
cd backend
python manage.py test rules.tests.test_conversion

# Frontend
cd frontend
npm test -- RuleConversionModal
```

### Integration Test

```bash
# Start all services
docker compose up -d

# Test conversion via GraphQL
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ conversionTargets { name description } }"}'
```

### Manual Test

1. Start HEFAISTOS: `docker compose up -d`
2. Login to UI
3. Navigate to any Sigma rule
4. Click "Convert" button
5. Select "Splunk" as target
6. Click "Convert Now"
7. Verify SPL query appears
8. Test Copy and Download

## 📚 Reference Documentation

- **Implementation Plan:** [Docs/RULE_CONVERSION_PLAN.md](./RULE_CONVERSION_PLAN.md)
- **Quick Reference:** [Docs/RULE_CONVERSION_SUMMARY.md](./RULE_CONVERSION_SUMMARY.md)
- **Recommendations:** [Docs/RULE_CONVERSION_RECOMMENDATION.md](./RULE_CONVERSION_RECOMMENDATION.md)
- **Index:** [Docs/RULE_CONVERSION_INDEX.md](./RULE_CONVERSION_INDEX.md)

## 🐛 Troubleshooting

### Sigconverter won't start

```bash
# Check logs
docker logs hefaistos-sigconverter

# Common issues:
# - Port 8000 in use: Change port in docker-compose.yml
# - Memory: Allocate more RAM to Docker
# - Build error: Check internet connection, try rebuild
```

### Backend can't reach sigconverter

```bash
# Verify network
docker network inspect hefaistos_hefaistos-net

# Test connectivity
docker exec hefaistos-backend ping sigconverter

# Check URL in settings
docker exec hefaistos-backend env | grep SIGCONVERTER
```

### Conversion fails

```bash
# Check if service is healthy
curl http://localhost:8100/api/v1/latest/targets

# Test conversion manually
RULE='title: Test
detection:
  selection:
    EventID: 4688
  condition: selection'

ENCODED=$(echo "$RULE" | base64 -w0)

curl -X POST http://localhost:8100/api/v1/latest/convert \
  -H "Content-Type: application/json" \
  -d "{\"rule\":\"$ENCODED\",\"target\":\"splunk\",\"format\":\"default\",\"pipeline\":[],\"pipelineYml\":null}"
```

## 🎓 Learning Resources

- [Sigma Rules](https://github.com/SigmaHQ/sigma)
- [pySigma](https://github.com/SigmaHQ/pySigma)
- [Sigconverter.io Source](https://github.com/hefaistos-platform/sigconverter.io)

## ✅ Checklist

Before starting:
- [ ] Read SIGCONVERTER_FIX_SUMMARY.md
- [ ] Read RULE_CONVERSION_PLAN.md
- [ ] Test sigconverter service works
- [ ] Verify backend can reach sigconverter

Backend implementation:
- [ ] Create conversion.py
- [ ] Update schema.py
- [ ] Add settings
- [ ] Write unit tests
- [ ] Test via GraphQL

Frontend implementation:
- [ ] Create conversion.ts
- [ ] Create RuleConversionModal.tsx
- [ ] Update RuleDetailPage.tsx
- [ ] Write component tests
- [ ] Test in browser

Final:
- [ ] Integration tests
- [ ] Manual testing
- [ ] Update CHANGELOG
- [ ] Merge PR

## 📞 Need Help?

- Check the detailed docs in `Docs/`
- Review the code examples in `RULE_CONVERSION_SUMMARY.md`
- Test the API directly with curl
- Check Docker logs for errors

---

**Good luck with the implementation! 🚀**
