# Rule Connector Format Detection Tests

## Overview

This directory contains test scripts to verify the format detection improvements for handling KQL rules stored in `.yml` files and other format variations.

## Problem Solved

**Original Issue:** KQL rules saved with `.yml` extension were being parsed as YAML, causing errors:
```
mapping values are not allowed here
  in "<unicode string>", line 2, column 9:
    // TITLE: T1098.005: Account Manipulatio ...
            ^
```

**Solution:** Implemented smart format detection that inspects file content to determine the actual format (KQL, SIGMA, or unknown) regardless of file extension.

## Test Scripts

### 1. Unit Tests: `test_format_detection.py`

Tests the `detect_format_from_content()` function with 8 different test cases covering:
- KQL rules (comment style, with let statements, with table names)
- SIGMA rules (standard format, minimal fields)
- Ambiguous/unknown content
- Empty files

**Run locally (if you have Python):**
```bash
python test_format_detection.py
```

**Run in Docker container:**
```bash
docker compose exec rule_connector python test_format_detection.py
```

**Expected output:**
```
✅ PASS: KQL Rule (Comment Style)
✅ PASS: KQL Rule with Let Statement
✅ PASS: KQL Rule with Table Names
✅ PASS: SIGMA Rule Standard Format
✅ PASS: SIGMA Rule with Minimal Fields
✅ PASS: Ambiguous Content
✅ PASS: Empty Content
✅ PASS: KQL with Pipes and Where
```

### 2. Integration Test: `test_problematic_file.py`

Tests format detection and parsing with the actual problematic file from the issue:
- File: `test_fixtures/kql_rule_as_yml.yml`
- Verifies the file is detected as KQL (not YAML)
- Extracts KQL metadata successfully
- Confirms YAML parsing would fail on it

**Run in Docker container:**
```bash
docker compose exec rule_connector python test_problematic_file.py
```

**Expected output:**
```
[TEST 1] Format Detection
Detected format: KQL
✅ PASS: File correctly detected as KQL

[TEST 2] KQL Metadata Extraction
Title: T1098.005: Account Manipulation
Description: Detects account manipulation activities...
Author: Security Research Team
Status: stable
Level: high
Tags: ['attack.t1098.005', 'attack.persistence', ...]
✅ PASS: KQL metadata extracted successfully

[TEST 3] YAML Parsing (should fail gracefully)
YAML parsing failed (as expected): mapping values are not allowed...
✅ PASS: Would have failed as YAML, but now handled as KQL

✅ All tests passed! The problematic file is now handled correctly.
```

## Format Detection Logic

The `detect_format_from_content()` function uses the following heuristics:

### KQL Indicators (scored):
- Starts with `//` comments
- Contains pipe operator `|` followed by KQL keywords (where, project, summarize, extend, etc.)
- Contains `let` statements (e.g., `let variable = ...`)
- References KQL table names (SecurityEvent, SigninLogs, DeviceProcessEvents, etc.)

### SIGMA Indicators (scored):
- Contains `title:` as YAML key
- Contains `logsource:` as YAML key
- Contains `detection:` as YAML key
- Contains `status: experimental|test|stable|deprecated`
- Contains `falsepositives:` as YAML key

### Decision Logic:
1. If KQL indicators > SIGMA indicators AND KQL count > 0 → **Detected as KQL**
2. Else if SIGMA indicators > 0 → **Detected as SIGMA**
3. Else → **Detected as UNKNOWN** (will be skipped)

## Logging Output

When a repo is synced, you'll see detailed format detection logs:

```
[FORMAT_DETECTION] /tmp/rule_repos/1/rules/kql/detailed-detection-rule-information.yml detected as KQL (KQL:4 vs SIGMA:0)
[PROCESSING] /tmp/rule_repos/1/rules/kql/detailed-detection-rule-information.yml - Detected format: KQL
[PROCESSING] Treating /tmp/rule_repos/1/rules/kql/detailed-detection-rule-information.yml as KQL (despite .yml extension)
[SUCCESS] Upserted KQL rule from .yml file: T1098.005: Account Manipulation
```

## Test Fixtures

### `test_fixtures/kql_rule_as_yml.yml`

A realistic KQL rule file with:
- Comment-based metadata (TITLE, DESCRIPTION, AUTHOR, TAGS, etc.)
- Multiple KQL queries separated by `---`
- Uses SecurityEvent table
- Proper KQL syntax with pipes and operators

This is the actual format of the file that was causing issues in the original bug report.

## Running End-to-End Test

To test the full integration with an actual repo pull:

1. Ensure your test rule repo has a `.yml` file with KQL content
2. Trigger a repo pull via the UI
3. Check logs for format detection output:
   ```bash
   docker compose logs -f rule_connector
   ```
4. Verify the rule was imported successfully in the UI

## Expected Improvements

After this fix, you should see:

✅ KQL rules with `.yml` extension are correctly parsed  
✅ KQL rules with `.yaml` extension are correctly parsed  
✅ Mixed rule repositories (SIGMA + KQL) work without errors  
✅ Better error handling and logging for ambiguous files  
✅ No more "mapping values are not allowed" errors for KQL files  

## Debugging

If tests fail:

1. Check test output for specific pattern matches
2. Review `detect_format_from_content()` patterns in `connector.py`
3. Add more patterns if you encounter new KQL or SIGMA formats
4. Run tests with DEBUG logging:
   ```bash
   docker compose exec rule_connector python -u test_format_detection.py 2>&1 | grep FORMAT_DETECTION
   ```

## Future Enhancements

- Support for WAZUH XML format detection
- Support for Splunk SPL format detection
- Support for Elastic EQL format detection
- Custom pattern registration system
- Format conversion utilities
