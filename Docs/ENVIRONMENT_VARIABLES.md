# Environment Variables

This document lists environment variables used by HEFAISTOS runtime configuration.

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

## AI Providers

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
