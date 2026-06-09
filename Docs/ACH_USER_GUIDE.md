# ACH Analysis User Guide: Hunting Anomalous PowerShell Execution

## Overview

This guide demonstrates how to use the **Analysis of Competing Hypotheses (ACH)** feature in Hefaistos to systematically evaluate security incidents. We'll walk through a real-world scenario: investigating suspicious PowerShell execution from a Microsoft Word document.

---

## What is ACH?

ACH is a structured analytical technique that helps security analysts:
- **Avoid confirmation bias** by explicitly considering alternative explanations
- **Systematically evaluate evidence** against multiple competing hypotheses
- **Identify the most diagnostic evidence** that rules out false leads
- **Document analytical reasoning** for team collaboration and reporting

### Key Concepts

- **Hypotheses**: Competing explanations for observed activity
- **Evidence**: Telemetry, logs, and observations gathered during investigation
- **Consistency Scores**: How well each piece of evidence fits each hypothesis
  - **CC** (Very Consistent): Evidence strongly supports the hypothesis
  - **C** (Consistent): Evidence aligns with the hypothesis
  - **N** (Neutral): Evidence neither supports nor contradicts
  - **I** (Inconsistent): Evidence conflicts with the hypothesis
  - **II** (Very Inconsistent): Evidence strongly contradicts the hypothesis

---

## Step-by-Step Tutorial

### Scenario Context

**Alert**: PowerShell process spawned from `WINWORD.EXE` on a finance department workstation.

**Framework Mappings**:
- **MITRE ATT&CK**: T1566.001 (Spearphishing Attachment), T1059.001 (PowerShell)
- **MITRE D3FEND**: D3-PSA (Process Spawning Analysis), D3-SA (Script Analysis)
- **MITRE Engage**: EGC0002 (Detect)

---

## Step 1: Create a New ACH Analysis

1. **Navigate to ACH Tool**
   - Click on **"ACH Matrix"** in the left navigation menu (located under "Lifecycle Hub")

2. **Create Analysis**
   - Click the **"New Analysis"** button
   - Enter a descriptive title: `PowerShell Execution from Word Document - Finance Dept`
   - Add description:
     ```
     Investigating PowerShell process spawned from WINWORD.EXE on workstation FINANCE-WS-042.
     Initial alert: PowerShell using Net.WebClient connecting to raw IP address.
     User: john.doe@company.com
     Time: 2025-12-28 14:23:15 UTC
     ```
   - Click **"Create"**

---

## Step 2: Define Your Hypotheses

Formulate **mutually exclusive** explanations for the observed behavior. These should cover the likely attack scenarios and benign alternatives.

### Add Hypotheses

For each hypothesis, click **"Add Hypothesis"** and enter:

**H1: Macro Malware**
```
Spearphishing attachment with malicious macro executing PowerShell payload
```

**H2: Shadow IT / Unauthorized Tool**
```
Employee using unauthorized automation script for legitimate business task
```

**H3: Authorized Admin Activity**
```
IT administrator performing system maintenance or deployment
```

**H4: Malicious Insider**
```
Authorized user deliberately executing malicious code for data exfiltration
```

💡 **Best Practice**: Include at least one "benign" hypothesis to avoid tunnel vision.

---

## Step 3: Collect and Document Evidence

Evidence should be **specific, verifiable facts** from logs, telemetry, or investigation findings.

### Add Evidence Items

For each piece of evidence, click **"Add Evidence"** and fill in:

#### E1: Script Uses Net.WebClient
- **Content**: `PowerShell script contains 'System.Net.WebClient' class for HTTP requests`
- **Credibility**: **High**
- **Data Source**: (Optional) Link to EDR/SIEM data source
- **Log Reference**: `Event ID 4688, Process: powershell.exe -enc <base64>`

#### E2: Connects to Raw IP Address
- **Content**: `Network connection to 185.220.101.47:443 (raw IP, no DNS resolution)`
- **Credibility**: **High**
- **Data Source**: NetFlow / Firewall Logs
- **Log Reference**: `FirewallLog-20251228-142315.log`

#### E3: Parent Process is WINWORD.EXE
- **Content**: `Parent process confirmed as WINWORD.EXE (PID 3344), child is powershell.exe`
- **Credibility**: **High**
- **Data Source**: EDR / Sysmon
- **Log Reference**: `Sysmon Event ID 1: Process Creation Chain`

#### E4: Obfuscated Base64 Encoding
- **Content**: `PowerShell invoked with -EncodedCommand parameter using Base64 obfuscation`
- **Credibility**: **High**
- **Data Source**: EDR Command-Line Logging
- **Log Reference**: `CommandLine: powershell.exe -w hidden -enc JABzAD0ATgBlAHcA...`

#### E5: No ITSM Change Ticket
- **Content**: `No active change ticket or scheduled maintenance for this system/user at incident time`
- **Credibility**: **High**
- **Data Source**: ServiceNow / ITSM Platform
- **Log Reference**: `Query: CHG* between 2025-12-28 13:00-15:00`

---

## Step 4: Score the Evidence Matrix

For each intersection of Evidence × Hypothesis, evaluate the **consistency**:

### Scoring Guide

Ask yourself: *"If [Hypothesis] were true, would I expect to see [Evidence]?"*

- **Consistent (C/CC)**: Yes, this evidence is expected
- **Inconsistent (I/II)**: No, this evidence contradicts the hypothesis
- **Neutral (N)**: Evidence is irrelevant or inconclusive

### Complete the Matrix

| Evidence | H1: Macro Malware | H2: Shadow IT | H3: Admin Activity | H4: Malicious Insider |
|----------|-------------------|---------------|--------------------|-----------------------|
| **E1: Net.WebClient** | **C** ✓ | **I** ✗ | **C** ✓ | **C** ✓ |
| **E2: Raw IP** | **C** ✓ | **I** ✗ | **I** ✗ | **C** ✓ |
| **E3: Parent=Word** | **C** ✓ | **C** ✓ | **II** ✗✗ | **C** ✓ |
| **E4: Base64 Obfuscation** | **C** ✓ | **I** ✗ | **I** ✗ | **C** ✓ |
| **E5: No ITSM Ticket** | **N** — | **N** — | **II** ✗✗ | **N** — |

#### Scoring Rationale

**E1: Script Uses Net.WebClient**
- **H1 (Malware): C** - Common in malware for downloads
- **H2 (Shadow IT): I** - Business users rarely code HTTP clients manually
- **H3 (Admin): C** - Admins might use for legitimate automation
- **H4 (Insider): C** - Expected for data exfiltration

**E2: Connects to Raw IP**
- **H1 (Malware): C** - Malware often uses IPs to avoid DNS logs
- **H2 (Shadow IT): I** - Business tools use domains, not IPs
- **H3 (Admin): I** - IT would use proper DNS names
- **H4 (Insider): C** - Expected for evasion

**E3: Parent Process is WINWORD.EXE**
- **H1 (Malware): C** - Classic malicious macro behavior
- **H2 (Shadow IT): C** - Users sometimes automate Word tasks
- **H3 (Admin): II** - Admins don't execute commands via Word macros
- **H4 (Insider): C** - Insider could use any method

**E4: Obfuscated (Base64)**
- **H1 (Malware): C** - Malware routinely obfuscates
- **H2 (Shadow IT): I** - Business users lack obfuscation knowledge
- **H3 (Admin): I** - Legitimate scripts are documented/clear
- **H4 (Insider): C** - Insider would hide malicious intent

**E5: No ITSM Ticket**
- **H1 (Malware): N** - Irrelevant to malware operations
- **H2 (Shadow IT): N** - Unauthorized but not necessarily malicious
- **H3 (Admin): II** - Authorized work requires change tickets
- **H4 (Insider): N** - Insider operates outside ITSM

---

## Step 5: Interpret the Results

### Hypothesis Scores

The ACH matrix automatically calculates scores based on **weighted inconsistency**. Lower scores indicate stronger hypotheses.

#### Score Calculation Formula

```
Hypothesis Score = Σ (Evidence Credibility Weight × Inconsistency Value)
```

Where:
- **Evidence Credibility Weight**:
  - HIGH credibility = 3x
  - MEDIUM credibility = 2x
  - LOW credibility = 1x
- **Inconsistency Value**:
  - "I" (Inconsistent) = 1 point
  - "II" (Very Inconsistent) = 2 points
  - "C" (Consistent) = 0 points
  - "CC" (Very Consistent) = 0 points
  - "N" (Neutral) = 0 points

#### Example Calculations

**H1 (Macro Malware)** - All evidence is consistent:
- E1: 3 (HIGH) × 0 (C) = 0
- E2: 3 (HIGH) × 0 (C) = 0
- E3: 3 (HIGH) × 0 (C) = 0
- E4: 3 (HIGH) × 0 (C) = 0
- E5: 3 (HIGH) × 0 (N) = 0
- **Total: 0** ✓

**H2 (Shadow IT)** - Evidence shows inconsistencies:
- E1: 3 (HIGH) × 1 (I) = 3
- E2: 3 (HIGH) × 1 (I) = 3
- E3: 3 (HIGH) × 0 (C) = 0
- E4: 3 (HIGH) × 1 (I) = 3
- E5: 3 (HIGH) × 0 (N) = 0
- **Total: 9** ✗

**H3 (Admin Activity)** - Strong inconsistencies:
- E1: 3 (HIGH) × 0 (C) = 0
- E2: 3 (HIGH) × 1 (I) = 3
- E3: 3 (HIGH) × 2 (II) = 6
- E4: 3 (HIGH) × 1 (I) = 3
- E5: 3 (HIGH) × 2 (II) = 6
- **Total: 18** ✗

**H4 (Malicious Insider)** - All evidence is consistent:
- E1: 3 (HIGH) × 0 (C) = 0
- E2: 3 (HIGH) × 0 (C) = 0
- E3: 3 (HIGH) × 0 (C) = 0
- E4: 3 (HIGH) × 0 (C) = 0
- E5: 3 (HIGH) × 0 (N) = 0
- **Total: 0** ✓

#### Final Scores

The system ranks hypotheses by score with **visual indicators** to show probability at a glance:

| Hypothesis | Score | Visual Bar | Category | Priority |
|------------|-------|------------|----------|----------|
| **H1: Macro Malware** | **0** | `█` | 🟢 **Most Likely** | Investigate First |
| **H4: Malicious Insider** | **0** | `█` | 🟡 **Plausible** | Secondary |
| **H2: Shadow IT** | **9** | `████████████████` | 🔴 **Eliminated** | Not Viable |
| **H3: Admin Activity** | **18** | `████████████████████████████████` | 🔴 **Eliminated** | Not Viable |

**Scoring Categories:**
- 🟢 **Most Likely** (Score 0–3): Primary working hypothesis; pursue aggressively
- 🟡 **Plausible** (Score 4–10): Cannot rule out; secondary lead; requires more evidence
- 🔴 **Eliminated** (Score 11+): Strong contradictions; deprioritize unless new evidence emerges

### Analysis

#### Eliminated Hypotheses

**❌ H3 (Admin Activity)** - **Eliminated** (Score: 18)
- Very inconsistent with parent process being Word
- No change ticket contradicts authorized work
- Obfuscation inconsistent with legitimate admin scripts
- **Visual**: 32-character bar shows maximum inconsistency

**❌ H2 (Shadow IT)** - **Eliminated** (Score: 9)
- Business users don't use Base64 encoding
- Raw IP connections unusual for productivity tools
- Net.WebClient is programming-level functionality
- **Visual**: 16-character bar shows significant inconsistency

#### Remaining Hypotheses

**✅ H1 (Macro Malware)** - **Most Likely** (Score: 0)
- All evidence is consistent with spearphishing attack
- Fits the MITRE ATT&CK pattern T1566.001 → T1059.001
- **Visual**: Minimal bar indicates best fit
- **Recommendation**: Primary investigation focus; initiate incident response

**⚠️ H4 (Malicious Insider)** - **Plausible** (Score: 0)
- Cannot be ruled out with current evidence
- Requires additional investigation to distinguish from H1
- **Visual**: Same score as H1; need diagnostic evidence to separate
- **Recommendation**: Secondary focus; pursue if H1 leads exhaust

---

## Step 6: Next Steps and Pivot Points

ACH helps identify **diagnostic gaps** - what additional evidence would definitively eliminate remaining hypotheses?

### Recommended Pivot Points

To distinguish between H1 (Malware) and H4 (Insider):

#### Investigate Email Origin (Favors H1)
- **Query**: Email logs for this user around incident time
- **Look for**: External sender, suspicious attachment
- **Tool**: Email gateway logs, Office 365 audit
- **Evidence**: `john.doe@company.com received email from external domain with .docm attachment at 14:15 UTC`

#### Investigate File Creation (Favors H4)
- **Query**: File system timeline for the Word document
- **Look for**: Local creation vs. network/email download
- **Tool**: Forensic timeline analysis, USN journal
- **Evidence**: `Document created locally on user desktop, no MRU from email/download`

#### User Intent & Context
- **Action**: Interview the user (if not compromised)
- **Questions**: Did you receive a document? Did you enable macros?
- **Correlation**: Recent travel, layoffs, financial stress (insider risk indicators)

### Automated Enrichment

Use the **AI Assistant** in Hefaistos ACH tool:
- Click **"✨ AI Assistant"**
- Describe: `User received suspicious email with macro-enabled document. Network shows C2 beacon pattern to 185.220.101.47.`
- AI will suggest additional hypotheses and evidence to consider

---

## Step 7: Document and Share

### Export Options

1. **Screenshot**: Capture the matrix for incident reports
2. **Link Sharing**: Share the ACH analysis URL with your team
3. **Integration**: Link evidence to Data Sources in Hefaistos catalog

### Response Playbook

Based on ACH conclusion (H1: Macro Malware), initiate:

1. **Containment**: Isolate `FINANCE-WS-042` from network
2. **Eradication**: Remove malicious document and PowerShell artifacts
3. **Investigation**: 
   - Extract and analyze Base64 payload
   - Threat intelligence lookup on `185.220.101.47`
   - Search for similar indicators across environment
4. **Remediation**: 
   - Re-image workstation
   - Force password reset for `john.doe@company.com`
   - Block IP at perimeter
5. **Lessons Learned**: Update email filtering rules, user training

---

## Best Practices

### Scoring Tips ⚡

- **Evidence credibility matters**: HIGH credibility evidence has 3x impact; set it correctly based on source reliability
- **Only inconsistency counts toward score**: Consistent (C/CC) and neutral (N) evidence contribute 0 points
- **Inconsistency eliminates hypotheses**: A hypothesis with many "I" and "II" ratings is ruled out
- **Lower scores win**: The hypothesis with the lowest total score is most supported
- **Zero scores are ties**: Multiple hypotheses with score 0 both remain plausible; need additional evidence to distinguish
- **Do the math**: Manually verify calculations: Score = Σ (Weight × Value) for each hypothesis

### Do's ✅
- **Start with 3-5 hypotheses** that are mutually exclusive
- **Use specific, measurable evidence** from actual telemetry
- **Set realistic credibility levels** (HIGH for direct telemetry, MEDIUM for logs, LOW for indirect indicators)
- **Link evidence to data sources** for audit trail and source tracking
- **Update the matrix** as new evidence emerges
- **Focus on inconsistencies** ("I" and "II" ratings) to eliminate hypotheses
- **Use the Devil's Advocate AI** feature to challenge your scoring and detect bias

### Don'ts ❌
- **Don't skip "benign" hypotheses** - consider false positive scenarios
- **Don't cherry-pick evidence** - include contradictory findings
- **Don't confuse correlation with causation** in scoring; use "N" if truly neutral
- **Don't ignore neutral evidence** - it may become diagnostic later
- **Don't work in isolation** - share ACH with team for peer review and sense-checking
- **Don't assume all evidence weighs equally** - adjust credibility based on source quality

---

## Advanced Features

### Devil's Advocate AI

When you assign a "Consistent (C)" score, Hefaistos AI may automatically warn:

> ⚠️ **Devil's Advocate Warning**
> 
> This evidence is also consistent with H4 (Malicious Insider). Consider if this evidence truly rules out alternative hypotheses or is merely circumstantial.

This helps detect **confirmation bias** where evidence fits multiple hypotheses equally.

### Template Library

Save frequently-used ACH templates:
- **Phishing Investigation Template**
- **Insider Threat Template**
- **Ransomware Outbreak Template**
- **Data Exfiltration Template**

Apply templates to new analyses for faster investigation.

### Live Evidence Linking

Link evidence directly to:
- **SIEM queries** in Data Catalog
- **EDR alerts** and process trees
- **Threat intelligence feeds**

Updates to linked data sources automatically refresh evidence credibility.

---

## Framework Integration

### MITRE ATT&CK® Mapping

Tag hypotheses with ATT&CK techniques:
- H1: `T1566.001, T1059.001, T1071.001`
- H4: `T1059.001, T1048, T1078`

Export to ATT&CK Navigator for coverage analysis.

### MITRE D3FEND™ Countermeasures

Document detection methods as evidence:
- D3-PSA (Process Spawning Analysis) → E3
- D3-SA (Script Analysis) → E4
- D3-NTA (Network Traffic Analysis) → E2

### MITRE Engage™ Activities

Classify investigation stage:
- **Detect (EGC0002)**: Initial alert and triage
- **Understand (EGC0003)**: ACH analysis phase
- **Affect (EGC0001)**: Response actions based on conclusion

---

## Conclusion

ACH transforms security investigations from intuition-based hunches to **structured, auditable analysis**. By systematically evaluating competing explanations, you:

1. Reduce false positives and analyst burnout
2. Document decision-making for compliance and training
3. Build institutional knowledge through reusable templates
4. Accelerate incident response with clear "go/no-go" criteria

**Next Steps**: Start your first ACH analysis in Hefaistos by navigating to **ACH Matrix** → **New Analysis**.

---

## Additional Resources

- **MITRE ATT&CK Framework**: [attack.mitre.org](https://attack.mitre.org)
- **ACH Methodology**: [CIA - Psychology of Intelligence Analysis](https://www.cia.gov/resources/csi/books-monographs/psychology-of-intelligence-analysis/)
- **Structured Analytic Techniques**: [Heuer & Pherson, 2015]
- **Hefaistos Documentation**: [docs.hefaistos.io/ach](https://docs.hefaistos.io/ach)

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-28  
**Hefaistos ACH Module**: v2.0
