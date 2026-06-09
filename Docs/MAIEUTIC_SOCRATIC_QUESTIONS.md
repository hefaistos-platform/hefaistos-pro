# Step-Aware Socratic Questions in the Maieutic Engine

## Overview

The Maieutic Engine's AI assistant employs **step-aware Socratic questioning** to guide threat hunters through a rigorous, hypothesis-driven detection engineering process. Unlike generic AI responses, each step in the workflow uses tailored prompts and examples to push analysts toward clarity, rigor, and understanding.

This methodology is grounded in the **Maieutic method** (Socratic inquiry) combined with modern **Detection Engineering Lifecycle (DEL)** principles and the **DCG420 Detection Analytic Template**.

## The Five Steps of the Maieutic Engine

### 1. **Hypothesis Generation**

**Goal:** Clarify what specific THREAT the user wants to detect.

**Key Principle:** Reject vague tool names. "Mimikatz" is not a hypothesis—it's a tool with 50 different functions. The AI forces specificity around **Intent**, **Capability**, and **Opportunity**.

#### Example Socratic Questions:

- **Instead of accepting:** "I want to detect Mimikatz"
- **AI asks:** "Mimikatz includes sekurlsa::logonpasswords, lsadump::dcsync, and token manipulation. Which behavior are you trying to detect?"

- **Instead of accepting:** "Detect lateral movement"
- **AI asks:** "Are you focused on the MECHANISM (e.g., LSASS handle access for credential dumping) or the ARTIFACT (e.g., dumped hashes in memory or network traffic)?"

- **Instead of accepting:** "I need detection for Kerberoasting"
- **AI asks:** "What is your INTENT? Lateral movement to high-value accounts? Privilege escalation? And where in YOUR environment would this occur—across untrusted domains, on a domain controller?"

#### Expected Outcome:

User articulates a **specific MITRE ATT&CK technique** and can describe:
- The adversary's objective (Intent)
- The specific behavior to detect (Capability)
- Where in their environment it's relevant (Opportunity)

Example refined hypothesis:
> "Detect T1003.001 - OS Credential Dumping via LSASS handle access using Mimikatz's sekurlsa::logonpasswords function"

---

### 2. **Interrogation & Technical Probing**

**Goal:** Expose gaps in their UNDERSTANDING of the attack mechanism.

Assumes they've defined a hypothesis. Now drill into **HOW it works** at the OS level, what data sources capture it, and where it can be evaded.

#### Example Socratic Questions:

- **Instead of accepting:** "Monitor LSASS access"
- **AI asks:** "LSASS memory access happens via OpenProcess → ReadProcessMemory. Which one does Sysmon capture via Event 10? And what are the legitimate reasons a process might access LSASS (e.g., Local Security Authority Subsystem Service, antivirus, EDR)?"

- **Instead of accepting:** "Look for suspicious registry activity"
- **AI asks:** "Kerberoasting relies on requesting service tickets. If you're monitoring Registry, you'd catch some TTPs but miss others. Windows Event ID 4769 logs TGS requests directly. Would that be better? Why would an attacker care which one you monitor?"

- **Instead of accepting:** "Filter by admin accounts"
- **AI asks:** "You're assuming the attacker is a known admin. But what about a compromised regular user elevating privileges? Or what if they use a service account that legitimately accesses LSASS? How do you distinguish?"

- **Instead of accepting:** "Check for credential dumping tools"
- **AI asks:** "There's no 'malware signature' in memory for Mimikatz. So how do you detect the BEHAVIOR independent of the tool? What OS primitives does ANY credential dumping tool need to use?"

#### Expected Outcome:

User understands:
- Specific Windows APIs, Event IDs, or network behaviors involved
- Data sources that capture the behavior (Sysmon, WMI, logs, network traces)
- Legitimate activities that mimic the attack (false positive scenarios)
- Which parts of the kill chain they can actually detect

Example refined understanding:
> "Sysmon Event 10 (ProcessAccess) will show processes accessing LSASS. But we'll see legitimate accesses from antivirus, DLLs, and system processes. We need to baseline legitimate callers and alert on NEW unexpected processes accessing LSASS."

---

### 3. **Robustness Assessment (Summiting the Pyramid)**

**Goal:** QUANTIFY the resilience of their detection logic on the 5-level Pyramid of Pain scale.

The AI assigns a **robustness level** (1-5) based on how easily the adversary can evade the detection by asking about evasion techniques and data source maturity.

#### Robustness Levels:

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| 1 | **Ephemeral** | Trivial to evade; hash/IP-based | Alerting on a specific malware hash or IP address |
| 2 | **Weak** | Easy to evade; tool name or simple modification | Detecting "Mimikatz.exe" by filename; evaded by renaming |
| 3 | **Moderate** | Requires some adversary effort to evade; behavior-based but with gaps | Detecting LSASS access, but missing legitimate admin tools |
| 4 | **Strong** | Targets invariant TTP mechanisms; hard to evade without reengineering | Detecting the specific Windows API sequence for credential dumping |
| 5 | **Invariant** | Detects fundamental OS/protocol mechanism; nearly impossible to evade | Detecting the kernel syscall used by ALL credential dumping methods |

#### Example Socratic Questions:

- **Instead of accepting:** "My rule detects suspicious registry paths"
- **AI asks:** "What if an attacker modifies a single character in the registry path you're monitoring? Or uses a completely different persistence mechanism? How invariant is this detection? Is it 2=Weak (path-based) or 4=Strong (behavior-based)?"

- **Instead of accepting:** "We monitor port 445 for SMB lateral movement"
- **AI asks:** "You're relying on a specific port. What if the attacker tunnels SMB traffic over HTTPS on port 443? Or over DNS? Does your detection survive port-based evasion? What's your robustness level—1=Ephemeral, 3=Moderate, or 4=Strong?"

- **Instead of accepting:** "Event ID 4769 (Kerberos TGS request)"
- **AI asks:** "You're relying on Windows audit logs. But what if your organization has log forwarding disabled? Or logs are batched hourly instead of real-time? And is your detection kernel-mode (Sysmon) or user-mode (Event logs)? Kernel-mode is more robust. What's your maturity score?"

- **Instead of accepting:** "We baseline against known admins"
- **AI asks:** "Baselining is powerful but fragile. If an attacker compromises a new admin account you haven't seen, your detection fails. How do you evolve the baseline? Can you also detect the BEHAVIOR independent of who the admin is? How does this affect robustness?"

#### Expected Outcome:

User assigns a **Robustness Level (1-5)** and can defend it by:
- Identifying evasion techniques they're vulnerable to
- Understanding data source maturity (User-Mode vs Kernel-Mode)
- Recognizing environmental dependencies
- Planning tuning/refinement strategies

Example refined robustness assessment:
> "Our detection is Level 3 (Moderate) - we catch LSASS access via Sysmon (Kernel-Mode = robust), but we're vulnerable to:
> - Evasion: Attacker using a legitimate admin tool we haven't basellined
> - Data gap: If Sysmon is disabled, detection fails
> - False positives: Antivirus scanning LSASS legitimately
> 
> To increase to Level 4, we'd need to correlate with subsequent actions (credential use) to confirm malicious intent."

---

### 4. **Playbook Design**

**Goal:** Help them design RESPONSE—both manual (human analyst) and automated (SOAR).

This step shifts from "detecting the threat" to "responding to the threat." The AI probes for both human triage workflows and machine-readable automation.

#### Example Socratic Questions:

- **Instead of accepting:** "Isolate the host"
- **AI asks:** "When your LSASS detection fires, what if the host is a domain controller? Isolating a DC might crash your entire Active Directory. Do you need a different response path? How do you differentiate?"

- **Instead of accepting:** "Fetch additional telemetry"
- **AI asks:** "What API calls can you make in 10 seconds? Process tree from EDR? Memory dump? Registry audit trail? Which telemetry will tell you if this is truly malicious? Which can you automate vs. what requires a human?"

- **Instead of accepting:** "Create a ticket and alert the analyst"
- **AI asks:** "If this rule fires 50 times/day on legitimate admin activity, you've created alert fatigue. How do you tune the rule? What's your false positive threshold? At what point do you suppress the alert until it's refined?"

- **Instead of accepting:** "Manual steps: 1. Check process name, 2. Check process hash"
- **AI asks:** "These are triage steps. Can these be automated? Can you automatically pull process hash from your asset database? Automatically query VirusTotal? Or does a human need to make the judgment? Where's the line between automation and human review?"

#### Expected Outcome:

User documents:
- **Manual Playbook:** Step-by-step analyst triage workflow with decision points
- **SOAR Playbook:** Machine-readable automation (API calls, conditionals, escalation paths)
- **False Positive Handling:** How to tune/refine the rule based on operational feedback
- **Escalation Paths:** When to escalate to incident response, forensics, etc.

Example refined playbook:
```
MANUAL PLAYBOOK:
1. [AUTOMATED] Fetch parent process and command line
2. [AUTOMATED] Query CMDB: Is this process expected on this host role?
3. [HUMAN] If unexpected: Check Windows Event 4688 (Process Creation) for context
4. [HUMAN] If legitimate admin: Add to baseline (don't suppress, refine rule)
5. [HUMAN] If malicious: Escalate to IR

SOAR PLAYBOOK:
1. [API] Query EDR for process tree (last 5 minutes)
2. [API] Query CMDB for host baseline expected processes
3. [CONDITIONAL] If process in baseline → suppress alert, log for tuning
4. [CONDITIONAL] If process NOT in baseline → 
   - [API] Create Incident ticket (priority=high)
   - [API] Trigger auto-isolation workflow
```

---

### 5. **Review & Finalization**

**Goal:** VALIDATE the entire detection hypothesis before deployment.

This final step is a "sanity check" to ensure the detection is operationally sound, fills a gap, and won't create alert fatigue.

#### Example Socratic Questions:

- **Instead of accepting:** "The rule is ready to deploy"
- **AI asks:** "Have you tested this against Atomic Red Team T1003.001? Did it trigger on a real lab LSASS dump? Did you verify false positives against your actual admin activity?"

- **Instead of accepting:** "This fills a gap"
- **AI asks:** "What gap does it fill? Do you already have a detection for T1003.001 from your EDR vendor? Is this detection better (higher fidelity, faster) or redundant? How does it fit your MITRE ATT&CK coverage map?"

- **Instead of accepting:** "It's documented"
- **AI asks:** "In 6 months, can another analyst understand this rule well enough to tune it? Can they explain to management why we alert on LSASS access? Or modify the rule if your environment changes (e.g., new admin tool)?"

- **Instead of accepting:** "We're ready to go"
- **AI asks:** "What's your False Positive baseline for the first week of deployment? At what FP rate would you roll it back? How will you measure True Positives (caught threats)? What metrics matter to you?"

#### Expected Outcome:

User confirms:
- **Test Results:** Validated against simulated/real attack scenarios
- **Coverage:** Fills a gap in MITRE ATT&CK coverage; not redundant
- **Operability:** Won't create alert fatigue; false positive rate is acceptable
- **Maintainability:** Clear documentation for future tuning

Example refined review:
> "✅ Tested via Atomic Red Team T1003.001 - triggered on LSASS dump
> ✅ Fills gap: We have no existing LSASS access detection
> ✅ FP baseline: ~5 FPs/day on legitimate admin, acceptable
> ✅ Documentation: Clear playbook for analysts, triage steps documented
> ✅ Metrics: Tracking True Positives and FP rate for first month
> 
> Ready for production deployment with weekly tuning review."

---

## How Step-Aware Questions Work

### The Flow

```
User enters Maieutic Engine
    ↓
HYPOTHESIS step: "I want to detect Mimikatz"
    ↓ [AI asks step-specific Socratic question]
    ↓ "Which Mimikatz function and what's your intent?"
    ↓
User refines: "Credential dumping via LSASS access"
    ↓
[User proceeds to INTERROGATION step]
    ↓
INTERROGATION step: "How does LSASS access work?"
    ↓ [AI asks technical probing questions]
    ↓ "Which Windows API? What Event IDs? What's legitimate?"
    ↓
User deepens understanding: "Sysmon Event 10, OpenProcess on LSASS"
    ↓
[User proceeds to ROBUSTNESS step]
    ↓
ROBUSTNESS step: "How resilient is this?"
    ↓ [AI asks evasion/maturity questions]
    ↓ "What if attacker uses different tool? What if LSASS monitoring is disabled?"
    ↓
User assigns Level 3 robustness with known gaps
    ↓
[Continue to PLAYBOOK and REVIEW steps...]
```

### Backend Implementation

The backend `run_maieutic_questioning()` function in `backend/ai_assistant/engine.py` receives the `current_step` parameter and uses it to select **step-specific system prompt instructions**.

```python
step_instructions = {
    'hypothesis': """STEP: HYPOTHESIS GENERATION
Your goal is to clarify what specific THREAT the user wants to detect.
Do NOT accept vague tool names...""",
    
    'interrogation': """STEP: INTERROGATION & TECHNICAL PROBING
Your goal is to expose gaps in their UNDERSTANDING of the attack mechanism...""",
    
    'robustness': """STEP: ROBUSTNESS ASSESSMENT
Your goal is to QUANTIFY the resilience of their detection logic...""",
    
    'playbook': """STEP: PLAYBOOK DESIGN
Your goal is to help them design RESPONSE—both manual and SOAR...""",
    
    'review': """STEP: REVIEW & FINALIZATION
Your goal is to VALIDATE the entire detection hypothesis..."""
}
```

Each step has:
- **Explicit goal statement** (what are we trying to accomplish)
- **Concrete example questions** (what good Socratic questioning looks like)
- **Probe targets** (what knowledge gaps to expose)

---

## Option 2: Hybrid Coach (Rules + Conditional AI)

This section defines a **rules-first** coaching layer that always provides hints and guardrails. AI is optional and only used when available and explicitly allowed.

### Core Behavior

- **Always-on hints:** Deterministic checks run on each step entry and on save.
- **No AI fallback if missing config:** If the AI API is not configured, the UI still shows hints and blocks invalid step completion.
- **Escalation policy:** If AI is configured, it is suggested only after repeated rule failures or explicit user request.
- **Works for juniors and seniors:** Hints are brief and neutral, with optional "Why this matters" expanders.

### Guardrails (Step Validation Rules)

These are lightweight checks to confirm the user has provided the minimum required elements for each step.

**Hypothesis**
- Must include **Intent** (goal or objective)
- Must include **Capability** (specific behavior)
- Must include **Opportunity** (where/when in the environment)
- Disallow vague tool-only statements (e.g., "detect Mimikatz", "Kerberoasting" with no intent)

**Interrogation**
- Must mention **data sources** (event logs, Sysmon, EDR, network telemetry)
- Must mention at least one **mechanism** (API, protocol, or OS behavior)
- Must identify at least one **legitimate lookalike** (false-positive risk)

**Robustness**
- Must declare a **Pyramid of Pain level** (1-5)
- Must list **one evasion risk**
- Must note **data dependency** (e.g., "requires DC auditing")

**Playbook**
- Must include **one automated action**
- Must include **one human decision point**
- Must include **escalation criteria**

**Review**
- Must include **test evidence** (lab/Atomic/real)
- Must include **false-positive baseline**
- Must include **coverage statement** (gap filled or redundancy)

### Hint Library (Examples)

These hints are shown when a required element is missing. Keep them short and actionable.

**Hypothesis**
- "What is your intent: lateral movement, privilege escalation, or credential access?"
- "Name the specific behavior, not just the tool (e.g., 'TGS ticket requests for service accounts')."
- "Where does this occur in your environment (DC, workstation, cross-domain)?"

**Interrogation**
- "Which log source captures this behavior (e.g., Event ID 4769, Sysmon)?"
- "What OS or protocol mechanism is used (Kerberos TGS, LSASS API calls)?"
- "What legitimate activity could look similar?"

**Robustness**
- "Pick a level 1-5 and explain one way an attacker could bypass this."
- "Is your detection dependent on a specific audit log being enabled?"

**Playbook**
- "Add one automated step (enrichment, ticketing, EDR query)."
- "Add one human decision (triage judgment, escalation trigger)."

**Review**
- "Have you tested in a lab or Atomic Red Team?"
- "What false-positive rate is acceptable in week one?"
- "Does this fill a gap or duplicate existing coverage?"

### AI Escalation Policy

- **Never call AI** if no API key or AI disabled in settings.
- **Suggest AI** only after two failed validations or explicit user request.
- **Limit usage** to one AI call per step per session by default.
- **Step-aware prompts** use the current step plus user text, not full workbench context.

### Minimal API Contract

These endpoints allow the frontend to request hints, validate content, and optionally invoke AI.

```
POST /api/maieutic/validate
{
    "step": "hypothesis|interrogation|robustness|playbook|review",
    "text": "user input text",
    "metadata": {
        "attempt": 1,
        "aiEnabled": false
    }
}

200 OK
{
    "valid": false,
    "missing": ["intent", "capability"],
    "hints": [
        "What is your intent: lateral movement, privilege escalation, or credential access?",
        "Name the specific behavior, not just the tool."
    ],
    "canSubmit": false
}
```

```
POST /api/maieutic/hints
{
    "step": "interrogation",
    "missing": ["data_source", "mechanism"]
}

200 OK
{
    "hints": [
        "Which log source captures this behavior?",
        "What OS or protocol mechanism is used?"
    ]
}
```

```
POST /api/maieutic/ai
{
    "step": "robustness",
    "text": "user input text",
    "context": {
        "attempt": 3,
        "aiEnabled": true
    }
}

200 OK
{
    "message": "AI Socratic response...",
    "followupQuestions": ["..."],
    "limitReached": false
}
```

### UX Notes

- Show a **step status badge**: "Missing intent" or "Ready to submit."
- Allow users to **dismiss hints** once addressed.
- Add "Why this matters" disclosure for senior users who want context.
- Provide **AI disabled** state text when no API is configured.


## Example: Kerberoasting Detection

To illustrate how step-aware questioning works, here's a complete example of detecting **T1558.004 - Kerberoasting**.

### Step 1: Hypothesis

**User Input:** "I want to detect Kerberoasting"

**AI Response (Socratic):**
> "Kerberoasting involves requesting TGS (Ticket-Granting Service) tickets for service accounts. But are you trying to detect:
> 1. The REQUEST itself (which users request tickets)?
> 2. The CREDENTIAL EXTRACTION afterward (cracking the ticket offline)?
> 3. The LATERAL MOVEMENT it enables (using compromised credentials)?
> 
> Your answer changes WHERE we look—Windows Event IDs (4769), network traffic (Kerberos packets), or subsequent logins. What's your intent?"

**User Refines:** "Detect when a user requests TGS tickets for high-value service accounts (Domain Admins)"

---

### Step 2: Interrogation

**User Input:** "So I look for Event ID 4769?"

**AI Response (Socratic):**
> "Event 4769 logs the TGS request. But here's the trap: EVERY user requesting tickets generates 4769—your mailbox, your printer, your CRM. So:
> 1. How do you know which service accounts are 'high-value'? Do you have a list?
> 2. Which users requesting these tickets is 'suspicious'? All of them? Only non-admins?
> 3. What happens if an attacker uses a HIGH-privilege user to request tickets—would that baseline as 'normal'?
> 4. Is Event 4769 being logged in your environment? Some orgs disable Kerberos auditing.
> 
> Once you answer these, we can build a detection rule."

**User Deepens Understanding:** "We have a list of 10 high-value accounts (DA, EA, etc.). We're interested when non-admin users request TGS for these accounts. Kerberos auditing is enabled enterprise-wide."

---

### Step 3: Robustness

**User Input:** "So the rule is: non-admin requests TGS for high-value accounts"

**AI Response (Socratic):**
> "That's a solid behavioral rule. But let's test evasion:
> 1. What if an attacker compromises an ADMIN account? Your detection assumes admins can request any ticket. But is that a blind spot?
> 2. What if they request tickets from a DIFFERENT domain (trust relationship)? Does Event 4769 capture cross-domain Kerberos?
> 3. What if they're **not** actually trying to crack the ticket offline—what if they're just gathering info?
> 
> And for data robustness:
> - Event 4769 is USER-MODE (logged by Windows). If the domain controller is unreachable, you miss traffic.
> - Is this LEVEL 2 (weak—detects most attackers but misses variants) or LEVEL 3 (moderate—detects variants but has gaps)?
> 
> What's your assessment?"

**User Quantifies:** "Level 2—we detect the standard Kerberoasting behavior but miss:
- Compromised admin requesting high-value tickets
- Cross-domain Kerberos attacks
- If DC logging is offline

To improve to Level 3, we'd add: correlation with failed logon attempts (attacker trying to crack the ticket)"

---

### Step 4: Playbook

**User Input:** "When the rule fires, what do we do?"

**AI Response (Socratic):**
> "Great question. Let's split this:
>
> **Manual Triage:** When Event 4769 alerts on a non-admin requesting DA tickets:
> - Is the user a helpdesk tech? (Legitimate—they reset DA passwords)
> - Is the user on the "trusted list"? (Administrators who manage these accounts)
> - Is this a service account itself requesting tickets? (Legitimate delegation)
>
> **Automated Response:** What can you automate?
> - Query user's manager from LDAP? Scope down to risky users?
> - Fetch logon history: Did this user succeed in logging in after the request?
> - Isolate the source host? (Maybe—too aggressive?)
>
> Which of these can you do in 10 seconds without human review?"

**User Designs:**

**Manual Playbook:**
1. [AUTO] Fetch user's group membership and manager
2. [AUTO] Check if user is on "trusted admin assistant" list
3. [HUMAN] If not on list: Check Event 4624 (successful logon) for that user in last 10 min
4. [HUMAN] If logon found: Escalate to IR (likely compromise)
5. [HUMAN] If no logon: Mark as "reconnaissance" and notify security team

**SOAR Playbook:**
```
1. Query LDAP for user's groups
2. If user in "trusted_admin_helpers" → suppress alert
3. If user in "domain_admins" → suppress alert (expected to request any ticket)
4. Else → trigger incident, send to SOAR for auto-response
```

---

### Step 5: Review

**User Input:** "This rule is ready to deploy"

**AI Response (Socratic):**
> "Before you deploy, verify:
> 1. Have you run Atomic Red Team T1558.004 in your lab? Did your detection fire?
> 2. How many Kerberoasting detections do you currently have? Is this redundant?
> 3. Over the first week, what's your expected false positive rate from legitimate admin assistants requesting tickets?
> 4. If FP rate is 50/day, is that acceptable? Or would you need to tune the rule?
> 
> And finally: In 6 months, can a junior analyst understand why we alert on this behavior, and what they should do when it fires?"

**User Confirms:** 
> ✅ Tested: Atomic Red Team T1558.004 triggered alert
> ✅ Gap: No existing Kerberoasting detection
> ✅ FP baseline: ~2 FPs/day from admin assistants (acceptable)
> ✅ Documentation: Clear triage playbook, escalation path defined
> ✅ Ready for production

---

## Benefits of Step-Aware Questioning

| Benefit | Example |
|---------|---------|
| **Prevents vague hypotheses** | Instead of "detect Mimikatz," user specifies "T1003.001 credential dumping via LSASS" |
| **Forces technical understanding** | User learns the Windows API calls, Event IDs, and OS mechanisms—not just pattern-matching |
| **Quantifies robustness** | Detection gets a robustness score (1-5) instead of hand-wavy "it works" |
| **Surfaces blind spots** | AI probes evasion techniques, exposing what the detection DOESN'T catch |
| **Operationalizes response** | Moves from "write a rule" to "design a complete manual + automated playbook" |
| **Validates before deployment** | Testing, gap analysis, and metrics are defined BEFORE the rule goes live |
| **Scalable methodology** | Even junior analysts following the prompts produce rigorous detection analytics |

---

## Using the Maieutic Engine

### How to Access

1. Open the Playbook Workbench
2. Click the **"Maieutic Engine"** button (usually in the toolbar)
3. The modal opens with the **Hypothesis** step active

### Workflow

1. **Start with your threat idea** (any level of vagueness is OK)
2. **Engage with the AI** - Answer its Socratic questions honestly
3. **Let the AI challenge you** - It will expose gaps; that's the point
4. **Progress through steps** - Use Next/Back to move between steps
5. **Review phase** - Confirm your detection is ready
6. **Import to workbench** - Click "Submit to Workbench" to populate your detection fields

### Tips for Best Results

- **Be honest about gaps** - "I don't know" is better than guessing
- **Engage with evasion questions** - Robustness assessment is where realism happens
- **Test in your lab** - Don't take AI advice on faith; validate with Atomic Red Team
- **Iterate** - Jump back to earlier steps if you discover new information
- **Document as you go** - The playbook design step is where you write down "who does what"

---

## References

- **Detection Engineering Lifecycle (DEL):** Industry framework for structured threat detection
- **Pyramid of Pain (David Bianco):** TTPs > Behaviors > Tools > Network indicators > Hashes/IPs
- **DCG420 Detection Analytic Template:** Structured template for detection documentation
- **Atomic Red Team:** MITRE's framework for simulating attack behaviors
- **MITRE ATT&CK:** Taxonomy of adversary tactics and techniques
- **Maieutic Method:** Socratic approach to knowledge discovery through questioning

---

## FAQ

**Q: Why doesn't the AI just write the rule for me?**  
A: Because you wouldn't understand it, and when the attacker adapts, you'd be stuck. The Socratic method forces you to BUILD understanding, so you can adapt your detection when threats evolve.

**Q: Can I skip steps?**  
A: Technically yes, but you shouldn't. Each step builds on the previous. Skipping Interrogation means you don't understand the OS mechanisms, which leads to brittle (Level 1-2) detections.

**Q: What if the AI asks something I don't know?**  
A: That's the point! It means you've found a gap. Go research it (Google, VirusTotal, Windows docs, your EDR vendor), then come back to the Maieutic Engine with your answer.

**Q: Does the AI replace threat intelligence analysts?**  
A: No. The AI is a Socratic tutor, not an oracle. Threat intelligence (knowing what tactics are relevant to YOUR org) still comes from humans. The AI just makes sure you think rigorously about the technical details.

**Q: What about AI hallucinations?**  
A: By restricting the AI to asking questions (not providing answers), we reduce hallucination risk. If the AI suggests an Event ID, you should verify it in Windows docs anyway.

---

## Version History

- **v1.0** (Jan 2026): Initial step-aware Socratic prompts for 5-step workflow
  - Hypothesis, Interrogation, Robustness, Playbook, Review
  - Step-specific prompt engineering
  - JSON response format with robustness recommendations

---

**Document Created:** January 12, 2026  
**Last Updated:** January 12, 2026  
**Maintainer:** HEFAISTOS Detection Engineering Team
