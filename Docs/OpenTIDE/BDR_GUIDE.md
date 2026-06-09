# Business Detection Rules (BDR) Guide

## Overview

Business Detection Rules (BDR) are compliance-driven detections that monitor for policy violations, regulatory non-compliance, and business logic abuse rather than traditional cyber threats.

## When to Use BDR

### Use BDR When:
- ✅ Detection is driven by compliance requirements (PCI DSS, GDPR, HIPAA, SOX)
- ✅ Monitoring business policy violations (unauthorized transactions, data exfiltration)
- ✅ Detecting insider threats and privilege abuse
- ✅ Tracking regulatory audit events
- ✅ Monitoring business-critical system access

### Use TVM/DOM/MDR (Threat Detection) When:
- ⚔️ Detecting adversary tactics from MITRE ATT&CK
- ⚔️ Responding to external threat intelligence
- ⚔️ Hunting for malware or exploitation
- ⚔️ Detecting network intrusions

## BDR vs. MDR Comparison

| Aspect | MDR (Threat Detection) | BDR (Business Detection) |
|--------|------------------------|--------------------------|
| **Driver** | MITRE ATT&CK technique | Compliance requirement |
| **Severity** | Tactical (CRITICAL/HIGH) | Strategic (business impact) |
| **Response** | SOC investigation | GRC escalation |
| **Example** | Credential dumping | Unauthorized PCI data access |
| **Objective** | Stop attacker | Prevent audit failure |

## BDR Schema Structure

```yaml
name: bdr_identifier
metadata:
  schema: bdr::2.1
  uuid: ...

description: What business rule is being enforced

criticality: Low | Medium | High | Critical

domains:
  - Finance
  - Healthcare
  - ...

targets:
  - Payment Systems
  - PHI Databases
  - ...

platforms:
  - Windows
  - Linux
  - ...

violation: Specific business rule violated

justification: |
  Regulatory citation and rationale

compliance_frameworks:
  - framework: PCI DSS
    version: "4.0"
    requirements: [...]
```

## Creating BDR in HEFAISTOS

### Step 1: Identify Compliance Requirement

Determine the specific regulation and requirement:
- PCI DSS 4.0 Requirement 8.2 (Authentication)
- GDPR Article 32 (Security of Processing)
- HIPAA Security Rule § 164.312(a)(1) (Access Controls)
- SOX Section 404 (Internal Controls)

### Step 2: Fill Workbench Fields

In the HEFAISTOS workbench:

**Goal:** Describe the business rule in plain language
> Monitor for unauthorized access to systems containing cardholder data (CHD) to ensure PCI DSS 4.0 compliance

**Technical Context:** Explain the detection logic
> Detect database queries accessing full PAN (Primary Account Number) from unauthorized network zones or by users without Data Access Authorization role

**Compliance Field:** (Add if not present — requires schema update)
> PCI DSS 4.0 Requirements 4.1, 8.2, 10.2.1

### Step 3: AI Classification

HEFAISTOS AI will analyze the goal and technical context:
- If keywords like "compliance", "PCI", "GDPR", "unauthorized access", "policy" are present → **BUSINESS** classification
- BDR is automatically generated

### Step 4: Review Generated BDR

In the OpenTIDE preview modal:
- Review the **BDR tab**
- Verify `criticality`, `domains`, `targets`, `platforms`
- Confirm `violation` and `justification` accuracy
- Override any incorrect AI-generated fields

### Step 5: Commit to InitTide

BDR is committed to `Objects/Business Rules/` directory in InitTide repository.

## Common BDR Patterns

### Pattern 1: Data Access Control
**Use Case:** Detect unauthorized access to sensitive data repositories

```yaml
violation: Unauthorized access to PHI database from non-clinical system
justification: HIPAA § 164.312(a)(1) - Access Control requirement
domains: [Healthcare]
targets: [PHI Databases]
criticality: Critical
```

### Pattern 2: Privilege Escalation
**Use Case:** Monitor for unauthorized privilege elevation

```yaml
violation: Non-administrator account granted Domain Admin privileges
justification: SOX Section 404 - Segregation of Duties
domains: [Enterprise IT]
targets: [Active Directory, Identity Management]
criticality: High
```

### Pattern 3: Financial Transaction Abuse
**Use Case:** Detect anomalous financial transactions

```yaml
violation: Transaction exceeding $10,000 without manager approval
justification: Sarbanes-Oxley Act - Financial Controls
domains: [Finance, Banking]
targets: [Payment Systems, Trading Platforms]
criticality: Critical
```

### Pattern 4: Data Exfiltration
**Use Case:** Monitor for bulk data downloads

```yaml
violation: Bulk download of customer PII exceeding 1000 records
justification: GDPR Article 32 - Data Security + Article 33 - Breach Notification
domains: [Enterprise]
targets: [CRM Systems, Customer Databases]
criticality: High
```

## BDR Response Workflow

Unlike threat detections (MDR) which go to SOC, BDR alerts follow compliance escalation:

```
BDR Alert Triggered
      ↓
GRC Team Notified
      ↓
Compliance Officer Review
      ↓
Business Impact Assessment
      ↓
Executive Escalation (if Critical)
      ↓
Audit Trail Documentation
```

## Best Practices

### 1. Precise Violation Statements
❌ Bad: "Unauthorized access detected"
✅ Good: "Unencrypted access to cardholder data from development network"

### 2. Cite Specific Requirements
❌ Bad: "GDPR violation"
✅ Good: "GDPR Article 32(1)(b) - Ability to ensure ongoing confidentiality"

### 3. Business-Centric Criticality
- **Critical:** Immediate audit failure or regulatory fine
- **High:** Significant compliance gap requiring remediation
- **Medium:** Policy deviation requiring documentation
- **Low:** Best practice recommendation

### 4. Clear Justification
Include:
- Regulation name and version
- Specific article/requirement number
- Why this detection enforces that requirement
- Potential business impact of violation

## Testing BDR

Create test scenarios to validate BDR logic:

```yaml
testing:
  scenario: Authorized access from production network
  expected: No alert

  scenario: Access from unauthorized network zone
  expected: CRITICAL alert to GRC team
```

## Migration: Converting MDR to BDR

If you have a threat detection (MDR) that's actually compliance-driven:

1. **Identify compliance driver:** What regulation requires this detection?
2. **Generate BDR:** Use "Force BDR Generation" in preview modal
3. **Customize fields:** Update violation/justification with regulatory citations
4. **Update response:** Change SOC → GRC escalation path
5. **Commit both:** Keep MDR for threat hunting, add BDR for compliance tracking

## FAQ

**Q: Can one playbook have both MDR and BDR?**
A: Yes! If a detection serves both threat hunting and compliance, commit both objects. Example: Credential dumping (MDR for threat + BDR for PCI DSS 8.2).

**Q: Who maintains BDR?**
A: GRC team owns BDR definitions. Detection engineering maintains MDR queries. Collaboration required.

**Q: How often are BDR reviewed?**
A: Quarterly minimum, or whenever regulations update (e.g., PCI DSS 4.0 release).

**Q: Do BDR trigger SIEM alerts?**
A: BDR can deploy to SIEMs via CoreTide, but alert routing goes to GRC, not SOC.
