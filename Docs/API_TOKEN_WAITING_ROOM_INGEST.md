# API Token & Waiting Room Ingest

HEFAISTOS supports personal API tokens for external integrations such as **KQL Striker**.
This document explains how to create a token and use it to send detections to the Waiting Room.

---

## 1. Create a Personal API Token

1. Log in to HEFAISTOS and open **My Profile** (top-right menu).
2. Scroll to the **API Tokens** section.
3. Click **+ Create Token**.
4. Enter a descriptive name (e.g. `KQL Striker Prod`).
5. The `waiting_room:create` scope is pre-selected — this is the scope required for the ingest endpoint.
6. Optionally set an expiry date.
7. Click **Create Token**.
8. **Copy the token immediately** — it starts with `hfst_` and is shown only once.

> ⚠️ Store the token securely (e.g. in a secrets manager or environment variable). HEFAISTOS never shows the plaintext again.

---

## 2. Ingest Endpoint

### `POST /api/waiting-room/cases`

Creates a new case in the Waiting Room from an external system.

**Authentication:**  
`Authorization: ******

**Content-Type:** `application/json`

### Request payload

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | ✅ | Identifier for the sending system (e.g. `kql-striker`) |
| `external_id` | string | ✅ | Unique ID from the source system — used for idempotency |
| `title` | string | ✅ | Case title |
| `severity` | string | — | `low`, `medium`, `high`, or `critical` (default: `medium`) |
| `description` | string | ✅ | Human-readable description of the detection |
| `artifacts` | array | — | List of `{ "type": "...", "value": "..." }` objects |
| `raw_output` | object | — | Arbitrary JSON payload from the source system |
| `detected_at` | datetime | — | ISO 8601 timestamp when detection occurred |

### Idempotency

Repeated requests with the same `source` + `external_id` combination for the same organisation
return the **existing** case (`200 OK`) instead of creating a duplicate (`201 Created`).
This means KQL Striker can safely retry on network failure.

### Response

```json
{
  "case_id": "c1234567-...",
  "status": "created",
  "waiting_room": true,
  "url": "/waiting-room/c1234567-..."
}
```

On duplicate: `status` is `"existing"` and HTTP status is `200`.

---

## 3. curl Example

```bash
curl -X POST https://<your-hefaistos-host>/api/waiting-room/cases \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "kql-striker",
    "external_id": "alert-2026-08-21-001",
    "title": "Suspicious sign-in pattern detected",
    "severity": "high",
    "description": "KQL Striker detected anomalous login sequence for alice@example.com.",
    "artifacts": [
      {"type": "ip", "value": "203.0.113.10"},
      {"type": "user", "value": "alice@example.com"}
    ],
    "raw_output": {
      "query": "SigninLogs | where ...",
      "rows": []
    },
    "detected_at": "2026-08-21T10:00:00Z"
  }'
```

---

## 4. Python Sender (KQL Striker)

```python
import os
import requests

HEFAISTOS_URL = os.environ["HEFAISTOS_URL"].rstrip("/")
HEFAISTOS_TOKEN = os.environ["HEFAISTOS_TOKEN"]  # hfst_...


def send_to_waiting_room(event: dict) -> dict:
    url = f"{HEFAISTOS_URL}/api/waiting-room/cases"
    headers = {
        "Authorization": f"******",
        "Content-Type": "application/json",
    }
    payload = {
        "source": "kql-striker",
        "external_id": event["event_id"],  # must be unique per alert
        "title": event["title"],
        "severity": event.get("severity", "medium"),
        "description": event.get("summary", ""),
        "artifacts": event.get("artifacts", []),
        "raw_output": event,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.json()
```

---

## 5. Error Codes

| HTTP Status | Meaning |
|---|---|
| `201 Created` | Case created successfully |
| `200 OK` | Duplicate — existing case returned |
| `400 Bad Request` | Validation error (see `errors` field in response) |
| `401 Unauthorized` | Missing or malformed `Authorization` header |
| `403 Forbidden` | Invalid token / revoked / expired / missing `waiting_room:create` scope |
| `500 Internal Server Error` | Unexpected server error |

---

## 6. Token Revocation

To revoke a token:
1. Open **My Profile → API Tokens**.
2. Click **Revoke** next to the token.

Revoked tokens are immediately rejected. There is no way to un-revoke a token — create a new one if needed.
