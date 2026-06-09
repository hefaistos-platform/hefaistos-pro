# Format Detection Enhancement - Deployment Checklist

## Pre-Deployment Verification

### Code Quality Checks
- [ ] **Python Syntax Validation**
  ```bash
  docker compose exec rule_connector python -m py_compile connector.py
  ```
  Expected: No output (exit code 0)

- [ ] **Import Validation**
  ```bash
  docker compose exec rule_connector python -c "from connector import detect_format_from_content; print('✓ Imports OK')"
  ```
  Expected: `✓ Imports OK`

### Test Execution

- [ ] **Unit Tests**
  ```bash
  docker compose exec rule_connector python test_format_detection.py
  ```
  Expected:
  ```
  ✅ PASS: KQL Rule (Comment Style)
  ✅ PASS: KQL Rule with Let Statement
  ✅ PASS: KQL Rule with Table Names
  ✅ PASS: SIGMA Rule Standard Format
  ✅ PASS: SIGMA Rule with Minimal Fields
  ✅ PASS: Ambiguous Content
  ✅ PASS: Empty Content
  ✅ PASS: KQL with Pipes and Where
  
  Test Results: 8 passed, 0 failed out of 8 tests
  ```

- [ ] **Integration Tests**
  ```bash
  docker compose exec rule_connector python test_problematic_file.py
  ```
  Expected:
  ```
  [TEST 1] Format Detection
  Detected format: KQL
  ✅ PASS: File correctly detected as KQL
  
  [TEST 2] KQL Metadata Extraction
  ✅ PASS: KQL metadata extracted successfully
  
  [TEST 3] YAML Parsing (should fail gracefully)
  ✅ PASS: Would have failed as YAML, but now handled as KQL
  
  ✅ All tests passed!
  ```

### Code Review
- [ ] Format detection logic is sound
  - Patterns are well-chosen
  - Scoring system makes sense
  - Edge cases handled
  
- [ ] Logging is appropriate
  - `[FORMAT_DETECTION]` logs helpful
  - `[PROCESSING]` logs show actions
  - `[SUCCESS]`/`[ERROR]` clearly labeled
  
- [ ] Error handling is robust
  - YAML errors handled gracefully
  - KQL parsing failures captured
  - No silent failures
  
- [ ] Backward compatibility confirmed
  - Existing SIGMA rules still work
  - Existing KQL rules still work
  - No API changes

## Deployment Steps

### Phase 1: Build & Test
```bash
# Step 1: Build the new rule_connector image
docker compose build rule_connector

# Expected: "Successfully tagged hefaistos-rule_connector:latest"
```

### Phase 2: Unit Testing
```bash
# Step 2: Start the container and run unit tests
docker compose up -d rule_connector
sleep 5  # Wait for container to be ready

# Step 3: Run unit tests
docker compose exec rule_connector python test_format_detection.py

# Verify: All 8 tests pass with ✅
```

### Phase 3: Integration Testing
```bash
# Step 4: Run integration tests
docker compose exec rule_connector python test_problematic_file.py

# Verify: All 3 sub-tests pass with ✅
```

### Phase 4: Live Testing
```bash
# Step 5: Test with actual repository pull
# 1. Go to UI and trigger a repository pull on a repo with .yml KQL files
# 2. Monitor logs for format detection
docker compose logs -f rule_connector | grep FORMAT_DETECTION

# Expected output:
# [FORMAT_DETECTION] /tmp/rule_repos/X/rules/kql/somefile.yml detected as KQL
# [PROCESSING] Treating /tmp/rule_repos/X/rules/kql/somefile.yml as KQL (despite .yml extension)
# [SUCCESS] Upserted KQL rule from .yml file: Rule Title
```

### Phase 5: Verification
```bash
# Step 6: Verify in UI
# - Navigate to /rules page
# - Search for newly imported KQL rules
# - Confirm rules display correctly
# - Confirm no errors in rule cards

# Step 7: Check final logs
docker compose logs rule_connector | tail -50

# Expected: No ERROR or WARNING messages related to format detection failures
```

## Rollback Plan (if issues occur)

```bash
# Step 1: Revert code changes
git checkout HEAD -- rule_connector/connector.py

# Step 2: Rebuild
docker compose build rule_connector

# Step 3: Restart
docker compose up -d rule_connector

# Step 4: Verify old behavior
docker compose logs rule_connector | tail -20
```

## Post-Deployment Monitoring

### Daily Check (First Week)
```bash
# Check for any format detection errors
docker compose logs rule_connector --since 24h | grep -E "(FORMAT_DETECTION|ERROR|WARNING)" | head -20

# Monitor success rate
docker compose logs rule_connector --since 24h | grep SUCCESS | wc -l
```

### Weekly Check
```bash
# Summary of imported rules by format
docker compose logs rule_connector --since 7d | grep "Finished processing repo" | tail -10
```

### Watch for:
- ❌ Repeated failures on same files
- ❌ Format detection errors
- ❌ YAML parsing errors that should have been KQL
- ❌ Performance degradation

### Good Signs:
- ✅ Rules importing successfully
- ✅ Format detection working for both KQL and SIGMA
- ✅ Detailed logs showing detection decisions
- ✅ No regression in SIGMA rule imports

## Documentation Updates

- [ ] Update team wiki/docs with new format detection capability
- [ ] Document supported rule formats: SIGMA, KQL (any extension)
- [ ] Add note about `.yml` files with KQL content now supported
- [ ] Link to TESTING.md for troubleshooting

## Team Communication

Before deployment, inform:
- [ ] Backend team (rule_connector changes)
- [ ] QA team (new test scripts available)
- [ ] DevOps (new deployment artifact)
- [ ] Product team (new capability for KQL `.yml` support)

## Success Criteria

Deployment is successful if:

✅ All unit tests pass (8/8)  
✅ All integration tests pass (3/3)  
✅ No regressions in SIGMA rule imports  
✅ KQL `.yml` files import without errors  
✅ Rules appear correctly in UI  
✅ Logs show proper format detection  
✅ No silent failures or lost data  

## Estimated Timeline

- Pre-deployment checks: 10 minutes
- Build & test: 15 minutes
- Live testing: 10 minutes
- **Total: ~35 minutes for safe deployment**

## Approval Gate

This deployment is ready when:
- [ ] All tests pass locally
- [ ] Code review approved
- [ ] This checklist completed
- [ ] User confirms readiness to proceed

---

**Prepared for:** {USER}  
**Date:** February 3, 2026  
**Status:** Ready for User Review and Approval

**Next Step:** User confirms they want to proceed with deployment → Run checklist
