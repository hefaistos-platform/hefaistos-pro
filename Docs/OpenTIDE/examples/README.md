# OpenTIDE Example YAML Files

This directory contains complete, working examples of OpenTIDE object types for developer reference and testing.

## Files

- **`tvm_example.yaml`** - Threat Vector Model (TVM) for T1003.001 LSASS credential dumping
- **`dom_example.yaml`** - Detection Objective Model (DOM) linking TVM to detection rules
- **`mdr_example.yaml`** - Managed Detection Rule (MDR) with multi-platform queries, testing, and tuning blocks
- **`bdr_example.yaml`** - Business Detection Rule (BDR) for PCI DSS compliance

## Usage

### Testing Validation

```python
from playbooks.utils.opentide_validator import validate_tvm_structure
import yaml

with open('Docs/OpenTIDE/examples/tvm_example.yaml') as f:
    tvm_data = yaml.safe_load(f)

is_valid, errors = validate_tvm_structure(tvm_data)
assert is_valid, f"Validation failed: {errors}"
```

### As Test Fixtures

```python
import pytest
import yaml

@pytest.fixture
def sample_mdr():
    with open('Docs/OpenTIDE/examples/mdr_example.yaml') as f:
        return yaml.safe_load(f)

def test_mdr_compilation(sample_mdr):
    assert sample_mdr['metadata']['schema'] == 'mdr::2.1'
    assert 'configurations' in sample_mdr
    assert 'testing' in sample_mdr
    assert 'tuning' in sample_mdr
```

### As Template Reference

Copy and customize examples when creating new detection rules:

```bash
cp Docs/OpenTIDE/examples/mdr_example.yaml InitTide/Objects/Detection\ Rules/my_detection.yaml
# Edit my_detection.yaml with your detection logic
```

## Field Descriptions

See [DEVELOPER_API_REFERENCE.md](../DEVELOPER_API_REFERENCE.md) for complete schema documentation.

See [BDR_GUIDE.md](../BDR_GUIDE.md) for guidance on when and how to use Business Detection Rules.
