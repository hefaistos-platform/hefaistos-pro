# Environment Variables

This document is the canonical reference for `.env` values used by HEFAISTOS.

- The quickest starting point is `.env.template`.
- Copy it with `cp .env.template .env` and only change values relevant to your deployment.
- Secret values should be provided via Docker secrets/files where possible.

---

## 1) Core Runtime

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `False` | Django debug mode (`True` only for local troubleshooting). |
| `SECRET_KEY` | *(required in secure deployments)* | Django secret key used for crypto/signing internals. |
| `ALLOWED_HOSTS` | `*` (runtime fallback) | Comma-separated hostnames/IPs accepted by Django. |
| `SERVER_DOMAIN` | *(empty)* | Public hostname used by several backend link builders. |
| `SERVER_PORT` | `443` (template) | Informational external HTTPS port for deployment tooling. |
| `ENVIRONMENT` | `production` (template) | Free-text deployment label (`production`, `staging`, etc.). |

## 2) Database (PostgreSQL)

| Variable | Default | Description |
|---|---|---|
| `DB_ENGINE` | `django.db.backends.postgresql` | Django DB backend engine (normally unchanged). |
| `DB_NAME` | `hefaistos_db` | PostgreSQL database name. |
| `DB_USER` | `hefaistos_user` | PostgreSQL username. |
| `DB_HOST` | `db` | PostgreSQL host inside Docker network. |
| `DB_PORT` | `5432` | PostgreSQL port. |
| `DB_PASSWORD_FILE` | `/run/secrets/db_password` | Secret-file path with DB password (recommended). |

## 3) RabbitMQ

| Variable | Default | Description |
|---|---|---|
| `RABBITMQ_HOST` | `rabbitmq` | RabbitMQ host in Docker network. |
| `RABBITMQ_PORT` | `5672` | RabbitMQ AMQP port. |
| `RABBITMQ_USER` | `hefaistos_mq` | RabbitMQ username. |
| `RABBITMQ_PASS_FILE` | `/run/secrets/rabbitmq_pass` | Secret-file path with RabbitMQ password. |
| `RABBITMQ_PASS` | *(empty)* | Direct password value (fallback when no secret file is used). |

## 4) Secret/File Paths

| Variable | Default | Description |
|---|---|---|
| `FIELD_ENCRYPTION_KEY_FILE` | `/run/secrets/field_key` | Secret-file path for DB field encryption key. |
| `FIELD_ENCRYPTION_KEY_PATH` | `/run/secrets/field_key` | Legacy fallback path for encryption key (backward compatibility). |
| `CONNECTOR_TOKEN_FILE` | `/run/connector/token.jwt` | Backend-side path to connector JWT token file. |
| `HEFAISTOS_API_TOKEN_FILE` | `/run/connector/token.jwt` | Connector-side path to API token file. |
| `OPENAI_API_KEY_FILE` | *(empty)* | Optional secret-file path for OpenAI key used in RAG/AI calls. |
| `MAILGUN_API_KEY_FILE` | `/run/secrets/mailgun_api` | Optional secret-file path for Mailgun API key. |

## 5) CORS / CSRF / Admin Access

| Variable | Default | Description |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | *(empty)* | Comma-separated browser origins allowed by CORS. |
| `CSRF_TRUSTED_ORIGINS` | *(empty)* | Comma-separated trusted origins for CSRF validation. |
| `ADMIN_ALLOWED_IP_RANGES` | `127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12` | CIDR allow-list for `/admin` access. |

## 6) Frontend / Public URLs

| Variable | Default | Description |
|---|---|---|
| `FRONTEND_URL` | `https://localhost` (backend fallback) | Public app URL for login links and notifications. |
| `PUBLIC_BASE_URL` | *(empty)* | Canonical external origin for share links and generated URLs. |
| `REACT_APP_API_URL` | *(empty)* | Legacy frontend API base URL (still supported). |
| `REACT_APP_NAVIGATOR_URL` | `https://mitre-attack.github.io/navigator/` | ATT&CK Navigator URL used by frontend. |
| `NODE_ENV` | `production` | Frontend build/runtime mode. |

## 7) WebAuthn / FIDO2

| Variable | Default | Description |
|---|---|---|
| `WEBAUTHN_RP_ID` | `localhost` | WebAuthn relying-party ID (must match public host). |
| `WEBAUTHN_ORIGIN` | falls back to `FRONTEND_URL` | Allowed WebAuthn origin. |

## 8) AI Providers (General)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(empty)* | Public OpenAI API key. |
| `GOOGLE_API_KEY` | *(empty)* | Google Gemini API key (optional if using Gemini). |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key (optional if using Claude). |
| `OLLAMA_BASE_URL` | *(empty)* | Optional self-hosted Ollama base URL. |

### Azure OpenAI (chat + embeddings)

Primary configuration is done in the UI (Org AI / Shared Profiles). Variables below are environment-level fallbacks.

| Variable | Default | Description |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | *(empty)* | Azure OpenAI endpoint (`https://<resource>.openai.azure.com`). |
| `AZURE_OPENAI_API_KEY` | *(empty)* | Azure OpenAI API key. |
| `AZURE_OPENAI_DEPLOYMENT` | *(empty)* | Azure chat/completion deployment name. |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | *(empty)* | Azure embedding deployment name used by Qdrant RAG sync/retrieval. |
| `AZURE_OPENAI_API_VERSION` | `2024-02-01` (RAG fallback) | API version used for Azure OpenAI calls if not explicitly set elsewhere. |

## 9) Qdrant / RAG

| Variable | Default | Description |
|---|---|---|
| `QDRANT_HOST` | `qdrant` | Qdrant host (Docker service alias by default). |
| `QDRANT_PORT` | `6333` | Qdrant HTTP port. |
| `QDRANT_API_KEY` | *(empty)* | Optional Qdrant API key for secured/Qdrant Cloud clusters. |

RAG embedding credential precedence in backend sync/retrieval logic:

1. Organization AI settings (including assigned shared profile)
2. User AI settings (OpenAI)
3. `OPENAI_API_KEY` / `OPENAI_API_KEY_FILE`
4. Azure embedding env vars (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`)

## 10) Scheduler / Workers / Runtime Flags

| Variable | Default | Description |
|---|---|---|
| `ENABLE_LSP_SERVERS` | `true` | Enable SyntaxTide LSP server processes in backend container. |
| `OPENTIDE_ENABLED` | `True` | Enable OpenTIDE-related features/workers. |
| `DIGEST_DAY` | `MONDAY` | Day of week for digest scheduler. |
| `DIGEST_HOUR` | `8` | Hour (24h) for digest scheduler. |
| `HEFAISTOS_INLINE_AI_FALLBACK` | `true` | Enable inline fallback when async AI worker is unavailable. |
| `HEFAISTOS_SECURITY_LOG_LEVEL` | `INFO` | Security event logger level. |
| `HEFAISTOS_DEPLOYER_LOG_LEVEL` | `INFO` | Rule deployer logger level. |
| `LOG_LEVEL` | `INFO` | General service log level (where supported). |
| `GUNICORN_WORKERS` | image/runtime default | Gunicorn worker override for backend web process. |
| `DJANGO_SETTINGS_MODULE` | `core.settings` | Django settings module override. |

## 11) Connectors

| Variable | Default | Description |
|---|---|---|
| `HEFAISTOS_API_URL` | `http://backend:8000/graphql` | GraphQL endpoint used by connector services. |
| `HEFAISTOS_BASE_URL` | `http://backend:8000` | Alternate base URL used by some connector logic. |
| `RABBITMQ_CONNECT_MAX_ATTEMPTS` | `25` | Connector retry attempts for RabbitMQ connection startup. |
| `PULL_INTERVAL_SECONDS` | `3600` | Poll interval used by threat intel connector. |

## 12) Email / Mailgun

| Variable | Default | Description |
|---|---|---|
| `EMAIL_ENABLED` | `False` (template) | Optional toggle used by deployment conventions; SMTP backend still reads email vars directly. |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` | Django email backend class path. |
| `EMAIL_HOST` | `smtp.mailgun.org` | SMTP host. |
| `EMAIL_PORT` | `587` | SMTP port. |
| `EMAIL_USE_TLS` | `True` | Enable STARTTLS. |
| `EMAIL_USE_SSL` | `False` (implicit) | Enable SMTPS when explicitly set. |
| `EMAIL_HOST_USER` | *(empty)* | SMTP username/sender login. |
| `EMAIL_HOST_PASSWORD` | *(empty or secret)* | SMTP password (supports secret-file fallback in runtime). |
| `DEFAULT_FROM_EMAIL` | fallback to `EMAIL_HOST_USER` / `noreply@localhost` | Default sender address. |
| `MAILGUN_API_BASE` | `https://api.eu.mailgun.net` | Mailgun API base URL (EU/US endpoints). |
| `MAILGUN_DOMAIN` | *(empty)* | Mailgun sending domain. |
| `MAILGUN_FROM_EMAIL` | *(empty)* | Mailgun "from" address override. |

## 13) Threat Intel (MISP)

| Variable | Default | Description |
|---|---|---|
| `MISP_URL` | *(empty)* | Global MISP URL for connector compatibility mode. |
| `MISP_VERIFY_SSL` | `true` (backend fallback), `false` in template example | Toggle TLS certificate verification for MISP calls. |
| `MISP_API_KEY` | *(empty or secret)* | MISP API key (usually provided via `/run/secrets/misp_key`). |

## 14) Elastic / MCS Security Event Export

| Variable | Default | Description |
|---|---|---|
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200` | Backend Elasticsearch URL. |
| `MCS_ELASTIC_ENABLED` | `true` | Enable export of security logs/events to Elasticsearch. |
| `MCS_ELASTIC_URL` | falls back to `ELASTICSEARCH_URL` | Target Elasticsearch URL for MCS logging pipeline. |
| `MCS_ELASTIC_INDEX_PREFIX` | `hefaistos-security` | Index naming prefix for exported events. |
| `MCS_RETENTION_DAYS` | `90` | Retention window used by MCS lifecycle logic. |
| `MCS_ELASTIC_TIMEOUT_SECONDS` | `3.0` | Elasticsearch write timeout for MCS exporter. |
| `HEFAISTOS_SERVICE_NAME` | *(empty)* | Optional explicit service name tag in exported logs. |
| `SERVICE_NAME` | *(empty)* | Alternate generic service name tag fallback. |

## 15) ATT&CK / Platform Data

| Variable | Default | Description |
|---|---|---|
| `MITRE_VERSION` | `19.0` | ATT&CK version used by import workflows. |
| `MITRE_IMPORT_MODE` | `remote` | Data source mode for ATT&CK import (`remote`/`local`). |

## 16) TLS/Certificate Automation

| Variable | Default | Description |
|---|---|---|
| `SSL_CERT_TYPE` | `self-signed` | Certificate mode (`self-signed` or `letsencrypt`). |
| `SSL_CERT_EMAIL` | *(empty)* | Contact email for ACME/Let’s Encrypt flows. |
| `SSL_CERT_DOMAIN` | *(empty)* | Domain used for ACME certificate issuance. |

## 17) OIDC / Authentication Advanced

| Variable | Default | Description |
|---|---|---|
| `OIDC_ID_TOKEN_LEEWAY_SECONDS` | `120` | Clock-skew allowance for OIDC ID token temporal claims. |
| `CORETIDE_WEBHOOK_SECRET` | *(empty or secret)* | Secret used to verify CoreTide webhook signatures. |

---

## Practical Notes

- After changing `.env`, recreate affected containers to reload values.
- For AI/RAG provider changes, recreate at least: `backend`, `ai_generation_worker`, `scheduler`.
- Keep `.env` out of source control; commit only `.env.template` updates.
