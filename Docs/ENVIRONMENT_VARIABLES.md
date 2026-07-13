<<<<<<< HEAD
# =============================================================================
# HEFAISTOS ENVIRONMENT CONFIGURATION TEMPLATE
# =============================================================================
# Copy this file to .env and fill in your deployment values
# DO NOT commit .env to version control
# Full reference: Docs/ENVIRONMENT_VARIABLES.md
# =============================================================================

# --- DJANGO CORE SETTINGS ---
DEBUG=False
SECRET_KEY=your-secret-key-here-generate-with-python-secrets

# --- SERVER CONFIGURATION ---
ALLOWED_HOSTS=app.example.com,192.168.1.100,localhost,127.0.0.1
SERVER_DOMAIN=app.example.com
SERVER_PORT=443
ENVIRONMENT=production

# --- DATABASE ---
DB_ENGINE=django.db.backends.postgresql
DB_NAME=hefaistos_db
DB_USER=hefaistos_user
DB_HOST=db
DB_PORT=5432
# Password is stored in .secrets/db_password (not here)

# --- RABBITMQ ---
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=hefaistos_mq
# Password is stored in .secrets/rabbitmq_pass (not here)

# --- SECRET FILE PATHS (Docker secrets mounts) ---
DB_PASSWORD_FILE=/run/secrets/db_password
RABBITMQ_PASS_FILE=/run/secrets/rabbitmq_pass
FIELD_ENCRYPTION_KEY_FILE=/run/secrets/field_key

# --- CORS & SECURITY ---
# Comma-separated list of allowed CORS origins. mitre-attack.github.io is always
# included automatically for the ATT&CK Navigator. Add your deployment domain here.
CORS_ALLOWED_ORIGINS=https://app.example.com,http://app.example.com
# Comma-separated list of trusted CSRF origins (must include the URL your browser uses).
CSRF_TRUSTED_ORIGINS=https://app.example.com,http://app.example.com
# Comma-separated CIDR ranges allowed to access /admin/.
# Defaults to localhost and Docker internal networks; override via ADMIN_ALLOWED_IP_RANGES env var.
ADMIN_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12

# --- FIELD ENCRYPTION ---
FIELD_ENCRYPTION_KEY_PATH=/run/secrets/field_key

# --- OPTIONAL: THREAT INTELLIGENCE ---
# MISP instances for the ADVOPS "Push to MISP" feature are now configured
# per-organization via the web UI: Settings → Repositories → MISP Instances.
# The env vars below are only needed for the threat_intel_connector service,
# which pulls MISP events from a single global instance to auto-create hunts.
# Leave them unset if you are not using the threat_intel_connector.
MISP_URL=https://misp.example.com
MISP_VERIFY_SSL=false
# MISP API Key is stored in .secrets/misp_key (not here)

# --- OPTIONAL: EMAIL NOTIFICATIONS ---
EMAIL_ENABLED=False
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=postmaster@mg.example.com
DEFAULT_FROM_EMAIL=noreply@example.com
# Email password is stored in .secrets/email_password (not here)

# Optional Mailgun-specific settings (used by notification connectors)
MAILGUN_API_BASE=https://api.eu.mailgun.net
MAILGUN_DOMAIN=mg.example.com
MAILGUN_FROM_EMAIL=noreply@example.com

# --- OPTIONAL: GRAPHQL LOGGING ---
GRAPHQL_DEBUG=False
GRAPHQL_LOG_QUERIES=True

# --- FRONTEND CONFIGURATION ---
FRONTEND_URL=https://app.example.com
# Canonical external origin used for generated share links (L1 Portal/OpenTIDE).
# Keep this equal to your publicly reachable URL when running behind multiple proxies/LBs.
PUBLIC_BASE_URL=https://app.example.com
REACT_APP_API_URL=https://app.example.com/graphql
REACT_APP_NAVIGATOR_URL=https://mitre-attack.github.io/navigator/
NODE_ENV=production

# --- WEBAUTHN / FIDO2 ---
# Required for security-key MFA and passwordless login.
# Must match your public host (HTTPS in production).
WEBAUTHN_RP_ID=app.example.com
WEBAUTHN_ORIGIN=https://app.example.com

# --- PLATFORM RUNTIME FLAGS ---
ENABLE_LSP_SERVERS=true
OPENTIDE_ENABLED=True

# --- SCHEDULER ---
DIGEST_DAY=MONDAY
DIGEST_HOUR=8

# --- CONNECTORS ---
CONNECTOR_TOKEN_FILE=/run/connector/token.jwt
HEFAISTOS_API_URL=http://backend:8000/graphql
HEFAISTOS_API_TOKEN_FILE=/run/connector/token.jwt
RABBITMQ_CONNECT_MAX_ATTEMPTS=25
PULL_INTERVAL_SECONDS=3600

# --- OPTIONAL: AI + SECURITY LOGGING ---
HEFAISTOS_INLINE_AI_FALLBACK=true
HEFAISTOS_SECURITY_LOG_LEVEL=INFO
HEFAISTOS_DEPLOYER_LOG_LEVEL=INFO

# --- OPTIONAL: MCS / ELASTIC SECURITY EVENT EXPORT ---
MCS_ELASTIC_ENABLED=true
MCS_ELASTIC_URL=http://elasticsearch:9200
MCS_ELASTIC_INDEX_PREFIX=hefaistos-security
MCS_RETENTION_DAYS=90
MCS_ELASTIC_TIMEOUT_SECONDS=3.0

# --- ATT&CK DATA ---
MITRE_VERSION=19.0
MITRE_IMPORT_MODE=remote

# --- SSL/TLS CERTIFICATES ---
SSL_CERT_TYPE=self-signed
# Options: self-signed, letsencrypt
# If letsencrypt: SSL_CERT_EMAIL=admin@example.com
# SSL_CERT_DOMAIN=app.example.com
=======
# Environment Variables

This document lists environment variables used by HEFAISTOS runtime configuration.

Sources used for this catalog:
- `.env.template`
- `docker-compose.yml`
- `docker-compose.override.yml.template`
- `backend/hefaistos/settings.py`
- `backend/core/settings.py`

## Required / Core

| Variable | Default | Description |
|---|---|---|
| `DB_NAME` | `hefaistos_db` | PostgreSQL database name used by backend and listener containers. |
| `DB_USER` | `hefaistos_user` | PostgreSQL username. |
| `DB_HOST` | `db` | PostgreSQL hostname inside Docker network. |
| `DB_PORT` | `5432` | PostgreSQL port. |
| `DB_PASSWORD_FILE` | `/run/secrets/db_password` | Path to Docker secret containing database password. |
| `RABBITMQ_USER` | `hefaistos_mq` | RabbitMQ username. |
| `RABBITMQ_PASS_FILE` | `/run/secrets/rabbitmq_pass` | Path to Docker secret containing RabbitMQ password. |
| `FIELD_ENCRYPTION_KEY_FILE` | `/run/secrets/field_key` | Path to Docker secret containing Django field encryption key. |
| `ALLOWED_HOSTS` | `*` | Django `ALLOWED_HOSTS` list (comma-separated). |
| `DEBUG` | `False` | Django debug mode (`True`/`False`). |
| `SECRET_KEY` | *(none)* | Django secret key. Set for non-development deployments. |

## Auth / JWT

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | falls back to `SECRET_KEY` | JWT signing key. |
| `JWT_ACCESS_TOKEN_MINUTES` | `60` | Access token lifetime in minutes. |
| `JWT_REFRESH_TOKEN_DAYS` | `7` | Refresh token lifetime in days. |

## CORS / CSRF / Frontend Origins

| Variable | Default | Description |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | *(empty)* | Comma-separated allowed CORS origins. |
| `CSRF_TRUSTED_ORIGINS` | *(empty)* | Comma-separated trusted CSRF origins. |
| `FRONTEND_URL` | `http://localhost` | Public frontend base URL for links/notifications. |

## Email / Notifications

| Variable | Default | Description |
|---|---|---|
| `EMAIL_BACKEND` | Django SMTP backend | Django email backend class path. |
| `EMAIL_HOST` | *(empty)* | SMTP host. |
| `EMAIL_PORT` | `587` | SMTP port. |
| `EMAIL_HOST_USER` | *(empty)* | SMTP username. |
| `EMAIL_HOST_PASSWORD` | *(empty)* | SMTP password. |
| `EMAIL_USE_TLS` | `True` | Enable STARTTLS for SMTP. |
| `DEFAULT_FROM_EMAIL` | `noreply@hefaistos.local` | Default sender address. |
| `MAILGUN_API_KEY_FILE` | `/run/secrets/mailgun_api` | Secret file path for Mailgun API key if Mailgun integration is enabled. |

## AI Providers (organization/user settings)

Provider keys may be stored in DB settings, but these env vars are commonly used for bootstrap or deployment wiring:

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key. |
| `GOOGLE_API_KEY` | *(empty)* | Google Gemini API key. |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key. |
| `OLLAMA_BASE_URL` | *(empty)* | Base URL for self-hosted Ollama endpoint. |
| `AZURE_OPENAI_API_KEY` | *(empty)* | Azure OpenAI API key. |
| `AZURE_OPENAI_ENDPOINT` | *(empty)* | Azure OpenAI endpoint URL. |
| `AZURE_OPENAI_API_VERSION` | *(empty)* | Azure OpenAI API version. |

## Elastic / Search

| Variable | Default | Description |
|---|---|---|
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200` | Backend connection URL to Elasticsearch. |

## Workers / Scheduler

| Variable | Default | Description |
|---|---|---|
| `DIGEST_DAY` | `MONDAY` | Weekly digest scheduler day. |
| `DIGEST_HOUR` | `8` | Weekly digest scheduler hour (24h). |

## Connector / Platform Integration

| Variable | Default | Description |
|---|---|---|
| `HEFAISTOS_BASE_URL` | `http://backend:8000` | Base URL used by connector services to call backend APIs. |
| `CONNECTOR_TOKEN_FILE` | `/run/connector/token` | Path to connector auth token file. |

## Optional Runtime / Deployment

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `hefaistos.settings` | Django settings module override. |
| `GUNICORN_WORKERS` | image/runtime default | Gunicorn worker count override. |
| `LOG_LEVEL` | `INFO` | Application log level. |

---

## Notes

- Docker secrets are preferred for sensitive values (`*_FILE` variables).
- Some integrations (AI providers, SMTP) can also be configured in application settings (database-backed) per organization/user.
- If both a direct value and `*_FILE` variant are supported by deployment scripts, prefer secret-file variants in production.
>>>>>>> a7ed4fc8 (Env var change)
