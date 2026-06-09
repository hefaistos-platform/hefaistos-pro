# How to Use the Maieutic Detection Engine

**The Maieutic Engine** is a specialized AI-driven assistant designed to guide security analysts through the **Detection Engineering lifecycle**. Unlike standard AI chatbots that simply generating code snippets, the Maieutic Engine uses the **Socratic Method** ("Maieutics" is the "midwifery of ideas") to help you "birth" high-quality, robust detections by asking probing questions.

It is designed to ensure that every detection you build is:
1.  **Robust**: Hard for attackers to evade (high on the Pyramid of Pain).
2.  **Validated**: Grounded in technical reality and available data sources.
3.  **Documented**: Fully explained with context, blind spots, and false positives.

---

## Core Philosophy

The engine is built on **DCG420 Principles** (Detection Capability Graded):
*   **Don't just detect the tool; detect the behavior.**
*   **Don't just detect the behavior; detect the intent.**
*   **Know your blind spots.**

Instead of giving you a detection rule immediately, the Engine will ask: *"How would an attacker bypass this?"* or *"What normal business activity looks like this?"*

---

## Workflow Phases

The Maieutic session moves through four distinct phases:

### 1. Hypothesis Phase
You start by stating a simple goal.
*   *You:* "I want to detect Mimikatz."
*   *Engine:* Parses this intent and sets up the session context.

### 2. Interrogation Phase (Socratic Questioning)
The Engine challenges your hypothesis to deepen the technical logic.
*   *Engine:* "Detecting the filename `mimikatz.exe` is trivial to bypass. How would you detect the process accessing LSASS memory regardless of the filename?"
*   *You:* Provide technical details (Event ID 10, GrantedAccess codes).
*   *Engine:* Validates and asks about potential false positives (e.g., antivirus scanners).

### 3. Robustness & Evaluation Phase
The Engine analyzes the maturity of your proposed detection.
*   It assigns a **Robustness Score** (1-5) based on the Pyramid of Pain.
    *   🔴 Level 1: Hash/IP (Trivial to evade)
    *   🟡 Level 3: Tools/Artifacts (Moderate)
    *   🔵 Level 5: TTPs/Behavior (Difficult to evade)
*   It identifies **Data Source Requirements** (e.g., "Requires Sysmon or EDR").

### 4. Playbook Generation Phase
Finally, the Engine synthesizes the conversation into a structured **Detection Playbook** ready for the Workbench, including:
*   A structured Sigma rule.
*   A list of known False Positives.
*   Documentation of Blind Spots.
*   Atomic Red Team test recommendations.

---

## How to Use It

1.  **Open the Workbench**: Navigate to the Playbook/Detection Workbench in the Hefaistos UI.
2.  **Launch Maieutic Engine**: Click the **"New Detection with Maieutic AI"** button (or "Refine" on an existing playbook).
3.  **Chat Interaction**:
    *   Answer the Engine's questions honestly.
    *   If you don't know an answer (e.g., "What specific API call is used?"), ask the Engine to help you research it.
    *   The Engine naturally guides you from "Product" (what tool) to "Process" (what behavior).
4.  **Review & Export**:
    *   When the Engine is satisfied, it will present a summary.
    *   Click **"Export to Workbench"** to populate the specific fields (Title, MITRE ID, Technical Context, Rule Logic).
5.  **Validation**:
    *   Run the suggested Atomic Red Team tests to verify the detection works in your environment.

---

## Use Case Examples

### Use Case 1: Detect Credential Dumping (Mimikatz)
**Goal:** Create a robust detection for LSASS dumping.

1.  **User Input:** "I want to write a rule to stop Mimikatz."
2.  **Engine Challenge:** "Defining 'Mimikatz' is broad. Are we looking for the file on disk, the execution of the command, or the memory access behavior?"
3.  **Refinement:** User selects "Memory access behavior."
4.  **Technical Deep Dive:**
    *   *Engine:* "What specific access rights does Mimikatz request when opening a handle to LSASS?"
    *   *User:* "I think it requests `PROCESS_VM_READ`?"
    *   *Engine:* "Correct. It often requests `0x1010` or `0x1410`. Let's focus on Sysmon Event ID 10 with those access masks. What legitimate processes might also do this?"
5.  **Outcome:** A detection rule based on **Sysmon Event ID 10** (ProcessAccess) targeting specific GrantedAccess flags, excluding known safe binaries (like Antivirus).
    *   **Robustness:** Level 4 (Strong - Behavioral).

### Use Case 2: Detect "Living off the Land" (Certutil Downloads)
**Goal:** Detect attackers using built-in Windows tools to download malware.

1.  **User Input:** "Detect when someone uses certutil."
2.  **Engine Challenge:** "Certutil is a common administrative tool. Detecting every usage will create too much noise. What specific arguments indicate malicious intent?"
3.  **Refinement:** User suggests "urlcache" and "split" arguments.
4.  **Blind Spot Check:**
    *   *Engine:* "Good. But attackers can rename `certutil.exe` to bypass filename checks. How do we catch that?"
    *   *User:* "We can look at the command line arguments `urlcache` and `-f` regardless of the process name."
    *   *Engine:* "Excellent. Also, be aware that `certutil` leaves artifacts in the CryptnetUrlCache. This is a forensic artifact we should note in the playbook."
5.  **Outcome:** A detection rule focusing on command line arguments `urlcache`, `-verifyctl`, or `-f` appearing in Process Creation events, agnostic of the executable name.
    *   **Robustness:** Level 3 (Moderate - Command Line parameters can be obfuscated, but specific flags are harder to hide).

---

## Integration Reference

The Maieutic Engine outputs data directly into the **WorkbenchDetail** view. Key mapped fields include:
*   **Robustness Level**: Visual indicator of detection quality.
*   **Technical Context**: The "Why" and "How" derived from the chat.
*   **Blind Spots**: Explicitly listed evasion techniques identifying what the rule *misses*.
