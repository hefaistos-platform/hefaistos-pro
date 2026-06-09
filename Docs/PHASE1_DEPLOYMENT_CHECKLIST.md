# Phase 1 Deployment Checklist - SIGMA Autocomplete Backend

## Pre-Deployment Verification

### Code Quality
- [x] No Python syntax errors (verified with get_errors)
- [x] Type hints present in all public methods
- [x] Docstrings for all classes and methods
- [x] Error handling with graceful degradation
- [x] Logging for debugging (`logger.error`)

### Testing
- [x] Unit tests for core functionality (15+ test cases)
- [x] Context analysis tests
- [x] Suggestion generation tests
- [x] YAML validation tests
- [x] Complete workflow tests
- [x] Edge case handling

### Database
- [x] Migration file created (`0013_autocomplete_caching.py`)
- [x] Models defined (SigmaKeyword, KQLTable, KQLField, FieldMapping)
- [x] Database constraints added
- [x] Management command for data population

### GraphQL Integration
- [x] `GetAutocompleteOptions` mutation defined
- [x] `AutocompleteResult` type defined
- [x] `AutocompleteSuggestion` type defined
- [x] Error handling in mutation
- [x] Mutation registered in Mutation class

### Documentation
- [x] Backend README with usage examples
- [x] GraphQL query examples
- [x] Management command documentation
- [x] Performance considerations documented
- [x] Troubleshooting guide included

---

## Deployment Steps

### Step 1: Backend Code Review
```bash
# 1.1 Verify all files exist
ls -la backend/rules/autocomplete/
# Should show:
# - __init__.py
# - base.py
# - sigma_engine.py
# - kql_engine.py
# - suggestions.py
# - README.md

# 1.2 Check for syntax errors
python -m py_compile backend/rules/autocomplete/*.py
python -m py_compile backend/rules/models.py
python -m py_compile backend/rules/schema.py
```

### Step 2: Database Migration
```bash
# 2.1 Create fresh migration (if needed)
python manage.py makemigrations rules --name "0013_autocomplete_caching"

# 2.2 Show migration plan
python manage.py showmigrations rules
# Should show: 0013_autocomplete_caching ... [ ]

# 2.3 Apply migration
python manage.py migrate rules 0013_autocomplete_caching
# Expected: "Running migrations:\n  Applying rules.0013_autocomplete_caching... OK"

# 2.4 Verify tables created
python manage.py dbshell
# Run: SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rules_%';
# Should include: rules_sigmakeyword, rules_kqltable, rules_kqlfield, rules_fieldmapping
```

### Step 3: Populate Keyword Cache
```bash
# 3.1 Populate SIGMA keywords
python manage.py populate_sigma_keywords
# Expected: "Successfully populated SIGMA keywords: 50 created, 0 updated"

# 3.2 Verify population
python manage.py dbshell
# Run: SELECT COUNT(*) FROM rules_sigmakeyword;
# Expected: 50
```

### Step 4: Run Tests
```bash
# 4.1 Run all autocomplete tests
python manage.py test rules.test_sigma_autocomplete -v 2

# 4.2 Run specific test class
python manage.py test rules.test_sigma_autocomplete.SigmaAutocompleteEngineTest -v 2

# 4.3 Run complete rules test suite
python manage.py test rules -v 2
```

### Step 5: GraphQL Testing
```bash
# 5.1 Start Django shell
python manage.py shell

# 5.2 Test autocomplete engine directly
from rules.autocomplete.sigma_engine import SigmaAutocompleteEngine
engine = SigmaAutocompleteEngine()
result = engine.get_autocomplete("title: ", position=7)
print(f"Suggestions: {[s.label for s in result.suggestions]}")

# 5.3 Test GraphQL mutation (using client)
# Use GraphQL IDE (Graphene graphiql) to execute:
# See "GraphQL Query Examples" section below
```

### Step 6: Backend API Testing
```bash
# 6.1 Using curl
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { getAutocompleteOptions(format: \"SIGMA\", prefix: \"t\", context: \"title: \", position: 7) { result { suggestions { label kind } isComplete } } }"
  }'

# Expected response should include suggestions with "title" or other matches

# 6.2 Using GraphQL client
# See example queries below
```

---

## GraphQL Query Examples

### Example 1: SIGMA Keywords
```graphql
mutation GetSigmaKeywords {
  getAutocompleteOptions(
    format: "SIGMA"
    prefix: "t"
    context: "title: "
    position: 7
  ) {
    result {
      suggestions {
        label
        kind
        insertText
        documentation
      }
      isComplete
    }
  }
}
```

Expected response:
```json
{
  "data": {
    "getAutocompleteOptions": {
      "result": {
        "suggestions": [
          {
            "label": "title",
            "kind": "keyword",
            "insertText": "title: ",
            "documentation": "Title of the SIGMA rule (required)"
          }
        ],
        "isComplete": true
      }
    }
  }
}
```

### Example 2: Status Values
```graphql
mutation GetStatusValues {
  getAutocompleteOptions(
    format: "SIGMA"
    prefix: "st"
    context: "status: st"
    position: 9
  ) {
    result {
      suggestions {
        label
        kind
      }
      isComplete
    }
  }
}
```

### Example 3: Logsource Categories
```graphql
mutation GetCategories {
  getAutocompleteOptions(
    format: "SIGMA"
    prefix: "proc"
    context: "logsource:\n  category: proc"
    position: 31
  ) {
    result {
      suggestions {
        label
        kind
      }
    }
  }
}
```

### Example 4: Large Rule Context
```graphql
mutation GetSuggestionsForLargeRule {
  getAutocompleteOptions(
    format: "SIGMA"
    prefix: "Image"
    context: "title: Process Detection\nid: 12345\nstatus: test\nlogsource:\n  category: process_creation\ndetection:\n  selection:\n    Image"
    position: 110
  ) {
    result {
      suggestions {
        label
        kind
        insertText
      }
    }
  }
}
```

---

## Performance Benchmarks

### Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| API Response | < 200ms p95 | Includes network overhead |
| Engine Processing | < 50ms p95 | Autocomplete engine only |
| Database Query | < 10ms | Minimal I/O |
| Memory Usage | < 10MB | Per request |
| Suggestions Count | 20 max | Limited for UX |

### Performance Testing
```bash
# Create performance test
python manage.py shell

from rules.autocomplete.sigma_engine import SigmaAutocompleteEngine
import time

engine = SigmaAutocompleteEngine()

# Test with small rule
small_rule = "title: Test\nstatus: test"
start = time.time()
for _ in range(100):
    engine.get_autocomplete(small_rule, len(small_rule))
print(f"100 requests on small rule: {(time.time()-start)*1000:.2f}ms")

# Test with large rule
large_rule = "title: Test\n" * 100
start = time.time()
result = engine.get_autocomplete(large_rule, len(large_rule))
print(f"Large rule autocomplete: {(time.time()-start)*1000:.2f}ms")
```

---

## Post-Deployment Verification

### 1. Database Integrity
```bash
# Check SIGMA keywords loaded
python manage.py shell -c "from rules.models import SigmaKeyword; print(f'Keywords: {SigmaKeyword.objects.count()}')"
```

### 2. GraphQL Endpoint
```bash
# Test GraphQL endpoint responds
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

### 3. Autocomplete Functionality
```bash
# Test mutation is registered
python manage.py shell -c "from django.core.management import execute_from_command_line; execute_from_command_line(['manage.py', 'graphql_schema'])"
# Should show getAutocompleteOptions in schema
```

### 4. Logs Monitoring
```bash
# Check for errors in logs
tail -f logs/error.log | grep -i autocomplete
# Should have no errors if tests passed
```

---

## Rollback Plan

If critical issues arise during deployment:

### Step 1: Immediate Actions
```bash
# 1.1 Revert database migration
python manage.py migrate rules 0012_rulerepository_auto_pull_enabled_and_more

# 1.2 Delete autocomplete tables
python manage.py dbshell
# DROP TABLE rules_sigmakeyword;
# DROP TABLE rules_kqlfield;
# DROP TABLE rules_kqltable;
# DROP TABLE rules_fieldmapping;
```

### Step 2: Code Rollback
```bash
# 2.1 Revert backend changes
git checkout HEAD~ backend/rules/schema.py
git checkout HEAD~ backend/rules/models.py
git checkout HEAD~ backend/rules/admin.py

# 2.2 Remove autocomplete package
rm -rf backend/rules/autocomplete/

# 2.3 Restart backend
python manage.py runserver
```

### Step 3: Verification
```bash
# Confirm GraphQL endpoint works
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

---

## Deployment Sign-Off

- [ ] Code reviewed and approved
- [ ] All tests passing (15/15 tests)
- [ ] Database migration successful
- [ ] SIGMA keywords populated (50+)
- [ ] GraphQL endpoint responding
- [ ] Performance benchmarks acceptable
- [ ] No critical errors in logs
- [ ] Documentation complete
- [ ] Team notified of deployment

---

## Next Steps: Phase 2 (Frontend)

After Phase 1 is deployed and validated in production for 1 week:

1. **Install Monaco Editor** in frontend
2. **Integrate autocomplete provider** with backend API
3. **Configure SIGMA language mode** in Monaco
4. **Add keyboard shortcuts** (Ctrl+Space, Enter to accept)
5. **Test feature preservation** (all existing features still work)
6. **Beta test** with selected users
7. **Full production rollout**

---

## Contact & Support

For issues during deployment:
- Check logs: `tail -f logs/error.log`
- Review this checklist for troubleshooting
- Run tests to isolate issues: `python manage.py test rules.test_sigma_autocomplete`
- Contact backend team for GraphQL integration support

---

**Deployment Date**: January 9, 2026  
**Status**: ✅ Ready for Deployment  
**Phase**: 1 of 4
