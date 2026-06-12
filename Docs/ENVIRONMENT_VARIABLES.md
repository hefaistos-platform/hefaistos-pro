# HEFAISTOS Environment Variables

This document lists all supported `.env` variables used by HEFAISTOS runtime services.

Source files considered:
- `docker-compose.yml`
- `backend/core/settings.py`
- backend workers/connectors and `hefaistos-sdk`
- frontend build-time env usage

## How to use

1. Copy `.env.template` to `.env`.
2. Set only the values you need for your deployment.
3. Keep secrets in `.secrets/*` (or use `*_FILE` variables), not in plain `.env` when possible.

---

## Core Platform

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `DEBUG` | `False` | Backend | Django debug mode. |
| `SECRET_KEY` | template placeholder | Backend | Django secret key. |
| `ALLOWED_HOSTS` | template value | Backend | Comma-separated hosts. |
| `SERVER_DOMAIN` | `app.example.com` | Installer/scripts | Canonical deployment domain. |
| `SERVER_PORT` | `443` | Installer/scripts | Metadata for deployment tooling. |
| `ENVIRONMENT` | `production` | Installer/scripts | Environment label. |
| `ENABLE_LSP_SERVERS` | `true` | Backend runtime | Enables SyntaxTide LSP worker startup. |
| `OPENTIDE_ENABLED` | `True` | Backend workers | Enables OpenTIDE HEF workers. |

## Public URL / Browser Security

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `FRONTEND_URL` | `https://app.example.com` (template), runtime fallback `https://localhost` | Backend, email links | Base URL for UI links. |
| `PUBLIC_BASE_URL` | `https://app.example.com` (template), runtime fallback empty | Backend share URLs | Canonical URL for externally shareable links (L1 Portal/OpenTIDE). |
| `CORS_ALLOWED_ORIGINS` | template value | Backend | Comma-separated origins. |
| `CSRF_TRUSTED_ORIGINS` | template value | Backend | Comma-separated trusted origins. |
| `ADMIN_ALLOWED_IP_RANGES` | template value | Backend middleware | CIDR list for `/admin/` access control. |
| `WEBAUTHN_RP_ID` | `app.example.com` | Backend | Security key RP ID. |
| `WEBAUTHN_ORIGIN` | `https://app.example.com` | Backend | Security key origin URL. |

## Database / RabbitMQ

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `DB_ENGINE` | `django.db.backends.postgresql` | Template compatibility | Metadata only; backend currently pins PostgreSQL engine in settings. |
| `DB_NAME` | `hefaistos_db` | Backend, Postgres service | DB name. |
| `DB_USER` | `hefaistos_user` | Backend, Postgres service | DB user. |
| `DB_HOST` | `db` | Backend | DB host. |
| `DB_PORT` | `5432` | Template compatibility | Backend currently uses fixed port `5432`. |
| `DB_PASSWORD` | unset | Backend | Optional direct DB password env. Prefer file/secret. |
| `DB_PASSWORD_FILE` | `/run/secrets/db_password` | Compose, backend entrypoint | File path for DB password. |
| `RABBITMQ_HOST` | `rabbitmq` | Backend/services/connectors | RabbitMQ host. |
| `RABBITMQ_PORT` | `5672` | Backend/services/connectors | RabbitMQ port. |
| `RABBITMQ_USER` | `hefaistos_mq` (template), code fallback `guest` | Backend/services/connectors | RabbitMQ user. |
| `RABBITMQ_PASS` | unset | Backend/services/connectors | Optional direct RabbitMQ password env. Prefer file/secret. |
| `RABBITMQ_PASS_FILE` | `/run/secrets/rabbitmq_pass` | Compose, backend/connectors | File path for RabbitMQ password. |

## Field Encryption

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEY` | unset | Backend | Direct Fernet key env. |
| `FIELD_ENCRYPTION_KEY_FILE` | `/run/secrets/field_key` | Compose, backend | Preferred key file path. |
| `FIELD_ENCRYPTION_KEY_PATH` | `/run/secrets/field_key` | Backend | Legacy fallback key path. |

## Email / Mailgun

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `EMAIL_ENABLED` | `False` | Installer/UI compatibility | Toggle marker for deployment workflows. |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` | Backend | SMTP backend class. |
| `EMAIL_HOST` | `smtp.mailgun.org` | Backend | SMTP host. |
| `EMAIL_PORT` | `587` | Backend | SMTP port. |
| `EMAIL_USE_TLS` | `True` | Backend | SMTP TLS flag. |
| `EMAIL_USE_SSL` | unset (code default `False`) | Backend | SMTP SSL flag. |
| `EMAIL_HOST_USER` | `postmaster@mg.example.com` | Backend | SMTP user. |
| `EMAIL_HOST_PASSWORD` | unset | Backend | SMTP password env (supports `EMAIL_HOST_PASSWORD_FILE`). |
| `DEFAULT_FROM_EMAIL` | `noreply@example.com` (template) | Backend | Sender address. |
| `MAILGUN_API_KEY` | unset | Backend mail service | Mailgun API key (supports `MAILGUN_API_KEY_FILE`). |
| `MAILGUN_API_BASE` | `https://api.eu.mailgun.net` | Backend mail service | Mailgun API endpoint. |
| `MAILGUN_DOMAIN` | `mg.example.com` | Backend mail service | Mailgun domain. |
| `MAILGUN_FROM_EMAIL` | `noreply@example.com` | Backend mail service | Mailgun from address. |
| `MAILGUN_API_KEY_FILE` | unset | Backend entrypoint | Optional file path for Mailgun API key. |

## MISP / Threat Intel Connector

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `MISP_URL` | `https://misp.example.com` (template) | Backend + threat_intel_connector | Global MISP URL (connector/global fallback). |
| `MISP_API_KEY` | unset | Backend + threat_intel_connector | Optional direct key env (supports `MISP_API_KEY_FILE`). |
| `MISP_VERIFY_SSL` | `false` (template/connector default) | threat_intel_connector, backend fallback | TLS verification for MISP requests. |
| `PULL_INTERVAL_SECONDS` | `3600` | threat_intel_connector | Poll interval. |

## Connectors / Worker Integration

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `HEFAISTOS_API_URL` | `http://backend:8000/graphql` | Connectors | GraphQL endpoint used by connectors. |
| `HEFAISTOS_API_TOKEN` | unset | Connectors | Optional direct JWT token. |
| `HEFAISTOS_API_TOKEN_FILE` | `/run/connector/token.jwt` | Connectors | Preferred token file path. |
| `CONNECTOR_TOKEN_FILE` | `/run/connector/token.jwt` | Backend startup | Where backend writes connector service token. |
| `RABBITMQ_CONNECT_MAX_ATTEMPTS` | `25` | Connector runtime | Connector reconnect attempts. |
| `DIGEST_DAY` | `MONDAY` | Scheduler | Weekly digest day. |
| `DIGEST_HOUR` | `8` | Scheduler | Weekly digest hour (0-23). |

## Frontend Build-Time

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `REACT_APP_API_URL` | `https://app.example.com/graphql` | Frontend build | API URL embedded into frontend build. |
| `REACT_APP_NAVIGATOR_URL` | `https://mitre-attack.github.io/navigator/` | Frontend build | ATT&CK Navigator URL. |
| `NODE_ENV` | `production` | Frontend build/runtime | Node/React build mode. |

## Logging / Observability (Optional)

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `HEFAISTOS_SECURITY_LOG_LEVEL` | `INFO` | Backend logging | Security logger level. |
| `HEFAISTOS_DEPLOYER_LOG_LEVEL` | `INFO` | Backend logging | Deployer logger level. |
| `HEFAISTOS_SERVICE_NAME` | unset | MCS logging | Service name override for security events. |
| `SERVICE_NAME` | unset | MCS logging | Alternate service name override. |
| `ELASTICSEARCH_URL` | unset | MCS logging | Elastic URL fallback for MCS handler. |
| `MCS_ELASTIC_ENABLED` | `true` | MCS logging | Enable Elasticsearch export for MCS events. |
| `MCS_ELASTIC_URL` | `http://elasticsearch:9200` (effective fallback) | MCS logging | Explicit Elasticsearch URL. |
| `MCS_ELASTIC_INDEX_PREFIX` | `hefaistos-security` | MCS logging | MCS index prefix. |
| `MCS_RETENTION_DAYS` | `90` | MCS logging | Retention (minimum 1). |
| `MCS_ELASTIC_TIMEOUT_SECONDS` | `3.0` | MCS logging | Elasticsearch HTTP timeout. |

## AI / Feature Flags (Optional)

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `HEFAISTOS_INLINE_AI_FALLBACK` | `true` | AI assistant schema | Enables inline fallback behavior for AI actions. |
| `HEFAISTOS_SERVICE_ACCOUNT` | `connector_svc` (effective fallback) | Connector SDK logging | Service account label in auth-failure logs. |

## Webhook Security

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `CORETIDE_WEBHOOK_SECRET` | unset | Backend webhooks | HMAC secret for CoreTide deployment webhooks (supports `CORETIDE_WEBHOOK_SECRET_FILE`). |

## Backup / Installer Metadata

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `BACKUP_ENABLED` | `True` | Installer/scripts | Backup automation toggle in installer workflows. |
| `BACKUP_SCHEDULE` | `0 2 * * *` | Installer/scripts | Cron schedule for backups. |
| `BACKUP_RETENTION_DAYS` | `30` | Installer/scripts | Backup retention window. |
| `BACKUP_PATH` | `/backups` | Installer/scripts | Backup target path. |
| `MITRE_VERSION` | `19.0` | Import workflows | ATT&CK import default version marker. |
| `MITRE_IMPORT_MODE` | `remote` | Import workflows | ATT&CK import mode marker. |
| `SSL_CERT_TYPE` | `self-signed` | Installer/scripts | SSL provisioning mode (`self-signed`/`letsencrypt`). |
| `GRAPHQL_DEBUG` | `False` | Legacy compatibility | Currently not consumed by active runtime settings. |
| `GRAPHQL_LOG_QUERIES` | `True` | Legacy compatibility | Currently not consumed by active runtime settings. |

---

## `*_FILE` pattern support

Many secret-like values support file-based loading using Docker secrets. Common pairs:

- `DB_PASSWORD` / `DB_PASSWORD_FILE`
- `RABBITMQ_PASS` / `RABBITMQ_PASS_FILE`
- `FIELD_ENCRYPTION_KEY` / `FIELD_ENCRYPTION_KEY_FILE`
- `EMAIL_HOST_PASSWORD` / `EMAIL_HOST_PASSWORD_FILE`
- `MAILGUN_API_KEY` / `MAILGUN_API_KEY_FILE`
- `MISP_API_KEY` / `MISP_API_KEY_FILE`
- `CORETIDE_WEBHOOK_SECRET` / `CORETIDE_WEBHOOK_SECRET_FILE`
- `HEFAISTOS_API_TOKEN` / `HEFAISTOS_API_TOKEN_FILE`

When both are set, use file-based values for production.
