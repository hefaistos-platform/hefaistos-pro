# strAIn Intelligence Extractor – URL Ingestion Guide

> **Version**: 1.0 (2026-04-13)  
> **Audience**: Security Analysts, Threat Intelligence Teams, SOC Teams

---

## Table of Contents

1. [Overview](#1-overview)
2. [How URL Ingestion Works](#2-how-url-ingestion-works)
3. [Supported URL Formats and Sources](#3-supported-url-formats-and-sources)
4. [Step-by-Step Guide](#4-step-by-step-guide)
5. [API Documentation](#5-api-documentation)
6. [Processing Workflow](#6-processing-workflow)
7. [Security – SSRF Protection](#7-security--ssrf-protection)
8. [Error Handling and Validation](#8-error-handling-and-validation)
9. [Configuration Requirements](#9-configuration-requirements)
10. [Integration with strAIn Features](#10-integration-with-strain-features)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Overview

**strAIn** (Strategic AI) is HEFAISTOS's built-in threat intelligence extraction engine. It uses AI models to analyze threat reports and automatically populate Adversary Operations (ADVOPS) hunt fields with structured intelligence.

**URL Ingestion** (PR #180) extends strAIn to work directly with online threat reports. Instead of manually downloading and uploading a report, you simply paste the URL and HEFAISTOS fetches, parses, and analyses the content automatically.

### What strAIn Extracts

From any threat report URL, strAIn produces:

| Field | Description | Example |
|-------|-------------|---------|
| **Hunt ID** | Suggested identifier | `ADV-26-001` |
| **Hypothesis** | Core threat behavior | "APT29 uses spear-phishing to deploy SUNBURST backdoor" |
| **Status** | Suggested workflow status | `RESEARCH` |
| **Priority** | Threat priority level | `HIGH` |
| **Verification Summary** | Key evidence and detection checks | "Check DNS for cobaltstrike.com beacons" |
| **Infrastructure Summary** | IOCs: IPs, domains, hashes | `45.142.212.100`, `update.solarwinds.com` |
| **Pivot Summary** | Related campaigns, actors, tools | "APT29 / Cozy Bear – linked to SolarWinds campaign" |
| **False Positive Summary** | Benign overlaps to consider | "Legitimate SolarWinds Orion traffic uses same port" |
| **MITRE Summary** | TTPs with IDs and names | `T1566.001 – Spearphishing Attachment` |
| **Detection Logic Summary** | Suggested detection queries | "Look for child processes of solarwinds.businesslayerhost.exe" |
| **Confidence** | AI confidence in extraction | `High` / `Medium` / `Low` |

---

## 2. How URL Ingestion Works

```
User pastes URL
  │
  ├── 1. Frontend validates URL format (client-side)
  │         Must be http:// or https://
  │
  ├── 2. GraphQL mutation: extractStrainDataFromUrl(url: "...")
  │
  ├── 3. Backend SSRF validation
  │         Blocks: localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x, etc.
  │
  ├── 4. Fetch URL with streaming (max 10 MB)
  │         Follows redirects – each hop re-validated for SSRF
  │
  ├── 5. Content-type detection
  │         PDF   → extract text with PyMuPDF / pdfminer
  │         HTML  → extract text with BeautifulSoup (strips tags)
  │         Other → treat as plain text
  │
  ├── 6. Text truncated to ~60,000 characters (~15-20k tokens)
  │
  ├── 7. AI extraction via configured provider
  │         (OpenAI / Azure OpenAI / Anthropic / local Ollama)
  │
  └── 8. Structured JSON result → auto-populate ADVOPS form
```

---

## 3. Supported URL Formats and Sources

### Content Types

| Content Type | Handling | Notes |
|-------------|----------|-------|
| `application/pdf` | Full PDF text extraction | Requires PyMuPDF or pdfminer |
| `text/html` | BeautifulSoup tag stripping | `<script>` and `<style>` removed |
| `application/xhtml+xml` | Same as HTML | |
| `text/plain` | Used as-is | |
| Other (`application/json`, etc.) | Treated as plain text | |

### Typical Sources

- Public threat intelligence reports (Mandiant, CrowdStrike, Unit42, etc.)
- Blog posts from security vendors
- CERT/CSIRT advisories
- CVE advisories and security bulletins
- OSINT reporting sites

### URL Requirements

- Must begin with `http://` or `https://`
- Must not resolve to a private/internal IP address
- Must be publicly accessible (no authentication required at the URL level)
- Response must be ≤ 10 MB

---

## 4. Step-by-Step Guide

### Step 1 – Open an ADVOPS Hunt

Navigate to **ADVOPS** in the left sidebar and either:
- Open an existing hunt to enrich it, or
- Click **New Hunt** to create a fresh one

### Step 2 – Locate the strAIn Intelligence Extractor Panel

At the top of the ADVOPS form you will see the **strAIn Intelligence Extractor** panel:

```
┌─────────────────────────────────────────────────────────────────┐
│  🧠 strAIn Intelligence Extractor                               │
│  Upload a document or paste a URL to auto-fill this hunt.       │
│                                                                 │
│  ┌────────────────────────────────────────────┐  [Analyze URL]  │
│  │ https://example.com/threat-report.pdf      │                 │
│  └────────────────────────────────────────────┘                 │
│                             OR                                  │
│  ┌────────────────────────────────────────────┐                 │
│  │  Drag & Drop a file here, or click         │                 │
│  │  to select  (PDF, TXT, MD, CSV)            │                 │
│  └────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3 – Paste the URL

1. Paste the full URL (including `https://`) into the input field
2. Press **Enter** or click **Analyze URL**

### Step 4 – Wait for Analysis

A loading indicator appears: `🔍 Fetching and analyzing report...`

Analysis typically completes in 10–30 seconds depending on:
- Report length
- AI provider response time
- Network latency to the report URL

### Step 5 – Review Extracted Data

Once complete, a success message appears: `✅ Analysis Complete! Review extracted data below.`

The extracted data is displayed in a collapsible panel below the extractor. Review each field before accepting.

### Step 6 – Apply to Hunt Fields

Click **Apply to Hunt** (or equivalent button) to populate the ADVOPS form fields with the extracted intelligence. You can edit individual fields after applying.

---

## 5. API Documentation

### GraphQL Mutation: `extractStrainDataFromUrl`

**Requires authentication.**

```graphql
mutation ExtractStrainDataFromURL($url: String!) {
  extractStrainDataFromUrl(url: $url) {
    result {
      huntId
      hypothesis
      status
      priority
      verificationSummary
      infrastructureSummary
      pivotSummary
      falsePositiveSummary
      mitreSummary
      detectionLogicSummary
      confidence
      error
    }
    providerUsed
  }
}
```

**Variables:**
```json
{
  "url": "https://www.mandiant.com/resources/reports/apt29-cozy-bear"
}
```

**Successful Response:**
```json
{
  "data": {
    "extractStrainDataFromUrl": {
      "result": {
        "huntId": "ADV-26-001",
        "hypothesis": "APT29 uses spear-phishing to compromise high-value targets and deploy SUNBURST backdoor",
        "status": "RESEARCH",
        "priority": "CRITICAL",
        "verificationSummary": "Check for solarwinds.businesslayerhost.exe spawning unexpected child processes\nMonitor DNS for avsvmcloud.com lookups",
        "infrastructureSummary": "45.142.212.100\navsvmcloud.com\ndefense.gov.mm.solarwinds.com",
        "pivotSummary": "APT29 (Cozy Bear) – linked to SolarWinds Orion supply chain compromise",
        "falsePositiveSummary": "Legitimate SolarWinds Orion management traffic on same ports",
        "mitreSummary": "T1566.001 – Spearphishing Attachment\nT1195.002 – Compromise Software Supply Chain\nT1059.003 – Windows Command Shell",
        "detectionLogicSummary": "Monitor solarwinds.businesslayerhost.exe for unusual child processes;\nAlert on DNS queries to avsvmcloud.com",
        "confidence": "High",
        "error": ""
      },
      "providerUsed": "openai"
    }
  }
}
```

**Error Response (invalid URL):**
```json
{
  "data": {
    "extractStrainDataFromUrl": {
      "result": {
        "huntId": "",
        "hypothesis": "",
        "status": "IDEA",
        "priority": "MEDIUM",
        "error": "Only http and https URLs are supported.",
        "confidence": "Low"
      },
      "providerUsed": "NONE"
    }
  }
}
```

### Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `huntId` | `String` | AI-suggested hunt identifier (e.g., `ADV-26-001`) |
| `hypothesis` | `String` | Core threat hypothesis / behavioral description |
| `status` | `String` | Suggested status: `IDEA`, `RESEARCH`, `DEVELOPMENT`, `APPROVED` |
| `priority` | `String` | `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| `verificationSummary` | `String` | Key checks and evidence points |
| `infrastructureSummary` | `String` | IOCs – IPs, domains, hashes (one per line) |
| `pivotSummary` | `String` | Related campaigns, threat actors, tools |
| `falsePositiveSummary` | `String` | Known benign overlaps |
| `mitreSummary` | `String` | MITRE ATT&CK TTPs (ID + name, one per line) |
| `detectionLogicSummary` | `String` | Suggested detection queries or logic |
| `confidence` | `String` | `High`, `Medium`, or `Low` |
| `error` | `String` | Error message (empty string if successful) |
| `providerUsed` | `String` | AI provider used: `openai`, `anthropic`, etc. |

---

## 6. Processing Workflow

### Content Fetching

The backend uses a streaming HTTP GET with a 30-second timeout. Redirects are followed manually (up to 10 hops) with SSRF re-validation at each hop:

```
GET https://example.com/report.pdf
  → 301 → https://cdn.example.com/report.pdf  (re-validated)
  → 200 OK  (stream body, max 10 MB)
```

### Content Parsing

#### PDF Reports

PDFs are processed using PyMuPDF (preferred) or pdfminer as fallback:
- All text layers extracted
- Tables and formatted text preserved where possible
- Images are ignored (text-only extraction)

#### HTML Pages

HTML is processed with BeautifulSoup:
- `<script>`, `<style>`, `<noscript>`, and `<head>` tags are removed
- Remaining text is extracted with `separator="\n"` and `strip=True`
- Result is a clean plain-text representation of the page content

#### Plain Text

Passed through directly to the AI extraction step.

### AI Extraction

The extracted text is trimmed to 60,000 characters (~15–20k tokens) and sent to the AI provider with the strAIn system prompt:

```
System: "You are 'strAIn', an elite automated Threat Intelligence Extractor.
Your task is to analyze the provided threat report and extract structured data
for an Adversary Operations Hunt. OUTPUT FORMAT: JSON ONLY."

User: "Extract intelligence from this document (report.pdf):\n\n<text>"
```

The AI response is parsed as JSON and mapped to the `StrainResult` GraphQL type.

### AI Provider Selection

strAIn uses the configured AI provider from the user's or organization's AI settings. The priority order is:
1. User-level AI settings (if configured)
2. Organization-level AI settings
3. Error if neither is configured

---

## 7. Security – SSRF Protection

URL ingestion includes robust Server-Side Request Forgery (SSRF) protection to prevent attackers from using HEFAISTOS to probe internal networks.

### Blocked Addresses

The following are rejected before any network request is made:

| Category | Examples |
|---------|---------|
| Loopback | `127.0.0.1`, `::1`, `localhost` |
| Private RFC 1918 | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` |
| Link-local | `169.254.0.0/16` (AWS metadata: `169.254.169.254`) |
| IPv6 private | `fc00::/7`, `fe80::/10` |
| Reserved | `0.0.0.0/8`, `100.64.0.0/10` |
| Multicast | `224.0.0.0/4` |

### Validation Process

1. **Scheme check** – Only `http` and `https` are accepted
2. **Hostname resolution** – Hostname resolved to all IP addresses via `getaddrinfo()`
3. **IP range check** – Each resolved IP checked against blocked networks
4. **Redirect re-validation** – Every redirect hop is re-validated with the same checks

### Non-Standard Ports

URLs with non-standard ports (e.g., `http://example.com:8080/report`) are allowed as long as the resolved IP is not in a private range.

---

## 8. Error Handling and Validation

### Client-Side Validation

Before sending the request, the browser validates:
- URL is not empty
- URL is parseable by the browser's `URL` constructor (catches malformed URLs)

```typescript
try {
  new URL(trimmedUrl);
} catch {
  message.error('Please enter a valid URL (e.g. https://example.com/report.pdf).');
  return;
}
```

### Server-Side Error Responses

All errors are returned as a valid GraphQL response with `result.error` populated:

| Error | `result.error` | `providerUsed` |
|-------|---------------|----------------|
| Not authenticated | Raises exception | – |
| No AI settings configured | `"Please configure AI settings first..."` | `"NONE"` |
| SSRF blocked URL | `"Requests to private/internal IP addresses are not allowed"` | `"NONE"` |
| DNS resolution failure | `"Could not resolve hostname 'x': ..."` | `"NONE"` |
| HTTP error (4xx/5xx) | `"HTTP error: 404 Client Error"` | `"NONE"` |
| Timeout | `"Request timed out after 30 seconds."` | `"NONE"` |
| File too large | `"File too large (exceeds 10 MB limit)."` | `"NONE"` |
| Too many redirects | `"Too many redirects."` | `"NONE"` |
| AI parse error | `"Failed to parse AI response: ..."` | `"ERROR"` |
| General failure | `"URL processing failed: <detail>"` | `"ERROR"` |

---

## 9. Configuration Requirements

### AI Provider Configuration

strAIn URL ingestion requires at least one AI provider to be configured. Configure providers in **Profile → AI Settings**:

| Provider | Required Keys |
|---------|--------------|
| OpenAI | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Ollama (local) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

Organization-wide AI settings can be configured in **Admin → AI Settings**.

### Python Dependencies

The following Python packages must be installed for full URL ingestion support:

```
requests           # HTTP client (core)
beautifulsoup4     # HTML parsing
PyMuPDF            # PDF text extraction (preferred)
pdfminer.six       # PDF text extraction (fallback)
```

These are included in the standard HEFAISTOS `requirements.txt`.

### Network Requirements

The HEFAISTOS backend container must have outbound internet access on ports 80 and 443 to fetch URLs. If your deployment is behind a proxy, configure:

```python
# backend/core/settings.py
HTTP_PROXY = 'http://proxy.example.com:3128'
HTTPS_PROXY = 'http://proxy.example.com:3128'
```

Or set the environment variables `HTTP_PROXY` / `HTTPS_PROXY` in your Docker Compose file.

---

## 10. Integration with Existing strAIn Features

### File Upload vs. URL Ingestion

Both methods use the same AI extraction pipeline (`run_strain_extraction`). The URL ingestion path adds a fetch-and-parse step before calling the same extraction function:

```
URL Ingestion:  URL → fetch → parse → base64 encode → run_strain_extraction()
File Upload:    file → read → base64 encode → run_strain_extraction()
```

This means both methods produce identical output structures and populate the same ADVOPS form fields.

### ADVOPS Hunt Integration

After extraction, the result is stored in the component state and offered to the user for review. Fields are mapped as follows:

| strAIn Field | ADVOPS Field |
|-------------|--------------|
| `huntId` | Hunt ID |
| `hypothesis` | Hypothesis |
| `status` | Status |
| `priority` | Priority |
| `verificationSummary` | Verification Summary |
| `infrastructureSummary` | Infrastructure / IOC Notes |
| `pivotSummary` | Pivot / Related Campaigns |
| `falsePositiveSummary` | False Positive Notes |
| `mitreSummary` | MITRE ATT&CK Coverage |
| `detectionLogicSummary` | Detection Logic Notes |

---

## 11. Troubleshooting

### "Please configure AI settings first"

**Cause**: No AI provider API key has been configured for your user or organization.

**Fix**: Go to **Profile → AI Settings** and add at least one provider key (e.g., your OpenAI API key).

### "Requests to private/internal IP addresses are not allowed"

**Cause**: The URL resolves to a private/internal IP – SSRF protection blocked the request.

**Common triggers**:
- Trying to use a local file server (e.g., `http://192.168.1.100/report.pdf`)
- AWS metadata endpoint (`http://169.254.169.254/`)
- Docker internal DNS (e.g., `http://backend:8000/`)

**Fix**: Use a publicly accessible URL.

### "Request timed out after 30 seconds"

**Cause**: The remote server is slow to respond or unreachable.

**Fix**:
1. Check that the URL is publicly accessible from your browser
2. Try downloading the report manually and use the **file upload** option instead

### "File too large (exceeds 10 MB limit)"

**Cause**: The report at the URL is larger than 10 MB.

**Fix**: Download the report, open it, copy the relevant sections into a `.txt` file, and use file upload with the trimmed version.

### "HTTP error: 403 Client Error"

**Cause**: The remote server blocked the request (rate limiting, geo-blocking, Cloudflare, etc.)

**Fix**:
1. Download the report manually from your browser
2. Use the **file upload** option with the downloaded file

### Analysis Returns Empty or Nonsensical Data

**Cause**: The page content could not be extracted meaningfully (e.g., the URL leads to a JavaScript-rendered page that returns only an empty HTML shell).

**Fix**: Use a **cached or PDF version** of the report. Many vendors provide PDF downloads alongside web pages.

### "Failed to parse AI response"

**Cause**: The AI provider returned a response that is not valid JSON (e.g., rate limit error message, partial response).

**Fix**:
1. Check your AI provider quota and rate limits
2. Try again after a short delay
3. Check the HEFAISTOS logs: `docker logs hefaistos_backend | grep "\[strAIn\]"`
