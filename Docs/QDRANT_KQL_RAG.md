# Qdrant + KQL RAG Integration

HEFAISTOS uses [Qdrant](https://qdrant.tech/) as a vector store to power a Retrieval-Augmented Generation (RAG) pipeline for AI-assisted KQL detection-rule authoring.  
When the `obs` profile is active, detection-rule templates are indexed in Qdrant. The AI assistant retrieves the most relevant templates at query time and includes them as grounding context before generating or suggesting new rules.

---

## Architecture Overview

```
 RuleRepository (Git)
        │
        │  rag_sync.py  (clones repo, parses JSONL/.kql files)
        ▼
 OpenAI text-embedding-3-small  ──►  1 536-dim embedding vector
        │
        ▼
 Qdrant collection: hefaistos_rule_templates
        │
        │  rag_store.py  (retrieve top-k by language + cosine similarity)
        ▼
 AI Assistant (engine.py)  ──►  LLM completion with retrieved context
```

### Components

| Component | Location | Purpose |
|---|---|---|
| `rules/rag_store.py` | Backend | Qdrant client setup, collection management, upsert & retrieval helpers |
| `rules/rag_sync.py` | Backend | Git clone → parse → embed → upsert pipeline |
| `rules/management/commands/run_rag_sync.py` | Backend | Django management command to trigger a sync manually |
| `ai_assistant/engine.py` | Backend | Calls RAG retrieval at generation time to augment the prompt |
| `qdrant` service | `docker-compose.yml` | Qdrant vector store container (profile `obs`) |

---

## Required Services & Dependencies

| Service / Package | Notes |
|---|---|
| **qdrant** (Docker service) | Started with `--profile obs`. Stores and serves embeddings over HTTP on port 6333. |
| **OpenAI API key** | Required for the embedding model (`text-embedding-3-small`). Configured either per-user in *AI Settings* or via the `OPENAI_API_KEY` environment variable. |
| **GitPython** | Python dependency used to shallow-clone rule template repositories. |
| **qdrant-client** | Python dependency used by `rag_store.py`. |

> **Note:** The Qdrant service is **optional**. The backend starts and operates normally when Qdrant is unavailable; RAG features are silently skipped. Only the `obs` profile brings Qdrant up.

---

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `QDRANT_HOST` | `qdrant` | Hostname of the Qdrant container (matches Docker network alias). Change for remote/Qdrant Cloud deployments. |
| `QDRANT_PORT` | `6333` | Qdrant HTTP port. |
| `QDRANT_API_KEY` | *(empty)* | API key for authenticated Qdrant Cloud / secured clusters. Leave empty for local deployments. |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key used for generating embeddings. Can also be set per-user in the platform's AI Settings UI. |

All variables are read at runtime; no restart of the backend is required after updating `.env` (a container restart is required for the change to take effect in Docker deployments).

---

## Local / Dev Startup

### 1. Start the `obs` profile (includes Qdrant)

```bash
docker compose --profile obs up -d
```

This starts `nginx`, `frontend`, `backend`, `db`, `rabbitmq`, `elasticsearch`, and `qdrant`.

### 2. Verify Qdrant is reachable

```bash
curl http://localhost:6333/healthz
# Expected: OK
```

### 3. Configure a Rule Repository for RAG

1. In the HEFAISTOS UI go to **Rule Repositories**.
2. Create or edit a repository and enable the **RAG sync** toggle.
3. Set the **Dataset path** to the directory or glob pattern inside the repo that contains JSONL or `.kql` template files (leave empty to scan all `.jsonl` files).
4. Set the **Branch** if templates live on a non-default branch.
5. Choose a **Sync schedule** (`24H`, `48H`, `72H`, `WEEKLY`, or `DISABLED`).

### 4. Trigger an initial sync manually

```bash
# Inside the backend container or with a local venv
docker compose exec backend python manage.py run_rag_sync <repository_id>
```

Or via the UI: open the repository detail page and click **Sync RAG now**.

---

## Template File Formats

The RAG pipeline accepts two input formats from a linked Git repository:

### JSONL (preferred)

One JSON object per line. Expected fields:

```json
{
  "title": "Detect lateral movement via PsExec",
  "description": "Looks for PsExec network patterns in Windows Security logs",
  "query": "SecurityEvent | where EventID == 4624 and LogonType == 3 ...",
  "language": "KQL",
  "author": "SOC Team",
  "tags": ["lateral-movement", "windows"]
}
```

Accepted field aliases: `name` → `title`, `details` → `description`, `detection`/`rule` → `query`, `format` → `language`.

### Raw `.kql` / `.txt` files

Each file is ingested as a single template entry. The filename (without extension) becomes the title and the full file content becomes the `raw_content` field.

### Supported Languages

`KQL`, `EQL`, `SPL`, `WAZUH`, `AQL`, `SIGMA`, `OTHER`. Defaults to `KQL` when not specified.

---

## Qdrant Collection Schema

Collection name: **`hefaistos_rule_templates`**

| Field | Type | Description |
|---|---|---|
| `source_id` | string (UUID) | Stable content-addressed identifier (SHA-256 of repo+path+line+content). |
| `language` | string (keyword) | Rule language tag, used for filtered retrieval. |
| `title` | string | Human-readable template title. |
| `description` | string | Template description. |
| `query` | string | The detection query string. |
| `raw_content` | string | Full raw file content (for `.kql`/`.txt` imports). |
| `author` | string | Template author. |
| `tags` | list of strings | Freeform tags. |
| `repo_name` | string | Source repository name. |
| `repo_path` | string | Relative file path inside the repository. |

Vector dimensions: **1 536** (OpenAI `text-embedding-3-small`). Distance metric: **Cosine**.

---

## Sync Lifecycle & Status Fields

The `RuleRepository` model tracks each sync:

| Field | Description |
|---|---|
| `rag_enabled` | Whether RAG sync is enabled for this repository. |
| `rag_branch` | Branch to clone (empty = default branch). |
| `rag_dataset_path` | Path/glob within repo to locate template files. |
| `rag_schedule` | Sync frequency: `DISABLED`, `24H`, `48H`, `72H`, `WEEKLY`. |
| `rag_last_sync_at` | Timestamp of the most recent sync attempt. |
| `rag_last_sync_status` | `ok`, `error`, or `pending`. |
| `rag_last_sync_error` | Error message from the last failed sync. |
| `rag_last_sync_upserted` | Count of templates successfully upserted in the last sync. |
| `rag_last_sync_skipped` | Count of templates skipped (embedding or upsert failure). |
| `rag_next_scheduled_sync` | Next scheduled automatic sync timestamp. |

---

## Operational Notes & Troubleshooting

### Qdrant not reachable

The backend logs a warning and continues. RAG context will be empty. Check that the `obs` profile is active and the container is healthy:

```bash
docker compose ps qdrant
docker compose logs qdrant
```

### No OpenAI key configured

Sync will fail with:

```
No OpenAI API key available for embedding. Configure one in AI Settings or set OPENAI_API_KEY env var.
```

Either add a key in **AI Settings → OpenAI API Key** or set `OPENAI_API_KEY` in your `.env` file and restart the backend.

### Git clone failure

Check that the repository URL is correct, the PAT/token has `read` access to the repo, and the branch name (if set) exists.

### Collection already exists with wrong schema

If you change the embedding dimensions or distance metric you must manually delete and recreate the collection:

```bash
curl -X DELETE http://localhost:6333/collections/hefaistos_rule_templates
```

Then re-run a sync. The collection will be recreated automatically on the next sync.

### Production / Qdrant Cloud

Set `QDRANT_HOST` to your Qdrant Cloud cluster URL (without scheme), `QDRANT_PORT` to `6333` (or the appropriate port), and `QDRANT_API_KEY` to your cluster API key.

```env
QDRANT_HOST=my-cluster.eu-central-1-0.cloud.qdrant.io
QDRANT_PORT=6333
QDRANT_API_KEY=<your-api-key>
```
