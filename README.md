# Hefaistos

<div align="center">

![HEFAISTOS Logo](frontend/public/logo.png)

**Enterprise Detection Engineering & Threat Intelligence Platform**

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)]()
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![Django](https://img.shields.io/badge/django-5.2-green.svg)](https://djangoproject.com)
[![React](https://img.shields.io/badge/react-18+-61dafb.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5+-blue.svg)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/docker-compose-2496ed.svg)](https://docker.com)

</div>

> *"What happens when one sleep-deprived human tries to fix security with the 'help' of AI systems that have never actually seen a network packet. Spoiler: surprisingly, it works."*

---

## 🎯 Overview

HEFAISTOS is a comprehensive **Detection Engineering Platform** designed for security operations teams. It provides an end-to-end workflow from threat hypothesis development through detection rule creation, testing, deployment, and MITRE ATT&CK coverage tracking.

### Key Capabilities

- 🔬 **Detection Workbench** - Visual graph-based detection development environment with advanced Capability Abstraction Map (auto-derived from library, layered bands, robustness encoding, gap detection)
- 🤖 **AI-Powered Rule Generation** - Multi-provider AI support (OpenAI, Gemini, Claude)
- 📊 **MITRE ATT&CK Integration** - Full coverage mapping and technique tracking
- 🕵️ **Threat Intelligence** - MISP integration for automated workbench creation
- 🔄 **Git Repository Sync** - Bidirectional KQL/SPL/WAZUH rule synchronization
- 📋 **ACH Analysis** - Structured Analysis of Competing Hypotheses
- 👥 **Collaborative Workflow** - Peer review and approval process
- 🏢 **Multi-Tenancy** - Organization and entity-based isolation (MSSP support)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              NGINX (Reverse Proxy)                      │
│                            Ports: 80 (HTTP) / 443 (HTTPS)               │
└─────────────────────────────────────────────────────────────────────────┘
                    │                                    │
                    ▼                                    ▼
┌─────────────────────────────┐        ┌─────────────────────────────────┐
│         Frontend            │        │           Backend               │
│    React 18 + TypeScript    │        │   Django 5.2 + GraphQL          │
│    TailwindCSS + Ant Design │        │   Gunicorn + WebSocket          │
│    React Flow (Graphs)      │        │   JWT Authentication            │
└─────────────────────────────┘        └─────────────────────────────────┘
                                                        │
                    ┌───────────────────────────────────┼───────────────────┐
                    │                                   │                   │
                    ▼                                   ▼                   ▼
        ┌───────────────────┐            ┌─────────────────────┐    ┌──────────────┐
        │    PostgreSQL     │            │     RabbitMQ        │    │ Elasticsearch│
        │    (Database)     │            │  (Event Messaging)  │    │   (Search)   │
        └───────────────────┘            └─────────────────────┘    └──────────────┘
                                                    ║
                    ┌───────────────────────────────┴───────────────────────────┐
                    │                   Event Connectors                        │
                    ├─────────────┬─────────────┬─────────────┬───────────────-─┤
                    │   Rule      │ Notification│ Threat Intel│   Git Push      │
                    │ Connector   │ Connector   │ Connector   │   Connector     │
                    │ (Git Sync)  │ (Alerts)    │ (MISP)      │ (Export Rules)  │
                    └─────────────┴─────────────┴─────────────┴────────────────-┘
```

---

## ✨ Features

### 🔬 Detection Workbench

The visual workbench provides a complete detection engineering environment:

- **Capability Abstraction Map** - Auto-generated visual graph derived from the Capability Abstraction Library; layer-band backgrounds, robustness color-coding, evasion annotations, coverage-gap nodes, and bidirectional click-to-highlight sync between the map and the library panel
- **Capability Abstraction Library** - Structured, technique-scoped knowledge library (shared baseline + org-custom entries) grounding AI generation in concrete detection layers (Tool → API → COM/IPC → Registry → Protocol → Process Behavior → Network Behavior)
- **Graph Visualization** - React Flow-based capability abstraction graphs with Auto (library-derived) and Manual modes
- **Detection Strategy** - MITRE ATT&CK technique and strategy selection
- **Deep Dive Sections** - Goal, technical context, blind spots, false positives
- **Testing Guidance** - Test scenarios and expected outputs
- **SOAR Configuration** - Alert triggers, enrichment, containment, notifications
- **Peer Review** - Built-in review request and approval workflow
- **Activity Tracking** - Persistent markdown investigation notes (formatting toolbar included) and activity log per workbench; note clearing is restricted to workbench author/admin
- **Adaptive Workspace Layout** - Right-side metadata/notes panel is collapsible and draggable (up to one-third of the page width), and the Multi-Platform Editor opens fullscreen for maximum editing space
- **Detection Editor Multi-Format Actions** - `GENERATE ALL` supports all registry formats with skip-by-default for non-empty targets, plus an optional **Overwrite all content** toggle; per-format `SAVE {FORMAT}` and `SAVE ALL` are also available in the modal

### 🤖 AI-Powered Detection Engineering

Multi-provider AI integration for intelligent rule generation:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5.5, GPT-5.4, GPT-5.4 Mini |
| **Google Gemini** | Gemini 3.1 Pro Preview, Gemini 3.5 Flash, Gemini 3 Flash Preview, Gemini 3.1 Flash Lite, Gemini 3.1 Flash Lite Preview |
| **Anthropic Claude** | Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5 |

**AI Capabilities:**

- **Logic Deconstruction** - 5-step analysis (capabilities, atomics, evasions)
- **Rule Generation** - Create KQL, SPL, or Wazuh rules from workbench context
- **Improvement Suggestions** - AI-powered rule optimization recommendations
- **ACH Generation** - Generate hypotheses and evidence from scenarios
- **Bias Detection** - Analyze ACH matrices for cognitive biases

### 📊 MITRE ATT&CK Integration

Full integration with MITRE ATT&CK framework:

- **Coverage Map** - Interactive ATT&CK Navigator showing detection coverage
- **Technique Mapping** - Link detections to Enterprise, ICS, and Mobile techniques
- **Detection Strategies** - Import MITRE detection strategies and analytics
- **Data Components** - Map required data sources to techniques

### 🔄 Rule Repository Management

Bidirectional synchronization with Git repositories:

**Inbound (Git → HEFAISTOS):**

- Automatic/scheduled repository pulls
- KQL/SPL/WAZUH file parsing with metadata extraction
- KQL file support (`.kql`, `.kusto`, Markdown with code blocks)
- Rule deduplication and updates

**Outbound (HEFAISTOS → Git):**

- Push workbenches as detection rules (KQL/SPL/WAZUH)
- GitHub Pull Request integration
- Automatic branch creation
- Configurable target paths

### 🕵️ Threat Intelligence Integration

MISP integration for threat-informed detection:

- **IoC Extraction** - IPs, domains, URLs, hashes, emails
- **Event Polling** - Automatic MISP event ingestion
- **Workbench Creation** - Auto-generate workbenches from events
- **ATT&CK Mapping** - Galaxy cluster technique mapping
- **SOAR Pre-population** - Default enrichment/triage steps

### 📋 Analysis of Competing Hypotheses (ACH)

Structured intelligence analysis tool:

- **Evidence Tracking** - Add evidence with credibility ratings
- **Hypothesis Management** - Create and organize competing hypotheses
- **Consistency Matrix** - Score evidence against hypotheses (CC/C/N/I/II)
- **Bias Detection** - AI-powered cognitive bias identification
- **Workbench Linking** - Convert hypotheses to detection workbenches

### 👥 Collaboration & Workflow

Enterprise-grade collaboration features:

**Lifecycle Management:**

```
IDEA → RESEARCH → DEVELOPMENT → REVIEW → APPROVED → TESTING → DEPLOYED → TUNING
```

**Review Workflow:**

- Submit for peer review
- Comment threads
- Approve/reject with feedback
- Activity audit log

**Multi-Tenancy:**

- Organization-based isolation
- Shared templates across entities
- Entity hierarchy (MSSP support)
- Role-based access control

### 📚 Additional Features

| Feature | Description |
|---------|-------------|
| **Knowledge Base** | Wiki-style documentation with categories and Markdown |
| **Data Catalog** | Data source registry with field schemas |
| **News & Announcements** | Platform-wide updates with priorities and auto-expiration |
| **Log Catalog** | Log source management with MITRE mapping |
| **Notification System** | In-app and email notifications |
| **Kanban Board** | Visual workflow management |
| **Tag System** | Flexible tagging across all entities |

---

## 🚀 Quick Start (30 Seconds)

**Automated Installation for Ubuntu 20.04+**

```bash
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos
chmod +x install-hefaistos.sh
sudo ./install-hefaistos.sh
```

The installation script will:

- ✅ Validate system requirements
- ✅ Install Docker and dependencies
- ✅ Guide you through interactive configuration
- ✅ Create SSL certificates (self-signed or Let's Encrypt)
- ✅ Generate and secure all secrets
- ✅ Setup database and create superuser
- ✅ Build and start all services
- ✅ Generate comprehensive installation report

**Estimated Time:** 15-30 minutes | **Estimated Cost:** Free (all open source)

### 📚 Installation Documentation

| Guide | Purpose | Time |
|-------|---------|------|
| **[QUICK_START.md](QUICK_START.md)** | 30-second setup overview | 2 min |
| **[CLEAN_INSTALL.md](CLEAN_INSTALL.md)** | Complete step-by-step guide | 15 min |
| **[INSTALLATION_SUITE_SUMMARY.md](INSTALLATION_SUITE_SUMMARY.md)** | Technical architecture | 10 min |
| **[INSTALLATION_README.md](INSTALLATION_README.md)** | Navigation & links | 5 min |

---

## 📖 Manual Installation

If you prefer manual setup instead of the automated script:

### 1. Clone the repository

```bash
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos
```

### 2. Copy configuration templates

```bash
cp .env.template .env
cp docker-compose.override.yml.template docker-compose.override.yml
```

`docker-compose.yml` now loads `.env` via `env_file` for backend/workers/connectors, so `.env` is the single source of truth for non-secret runtime configuration.

By default, Nginx is published as host `80 -> 8080` and `443 -> 8443`.
If those host ports are occupied, remap only in `docker-compose.override.yml` (keep container ports `8080/8443` unchanged), for example:

```yaml
services:
  nginx:
    ports:
      - "8080:8080"
      - "4443:8443"
```

### 3. Generate secrets

```bash
mkdir -p .secrets
openssl rand -base64 32 > .secrets/db_password
openssl rand -base64 32 > .secrets/rabbitmq_pass
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > .secrets/field_key
# Optional: only needed for the threat_intel_connector (MISP → auto-hunt creation)
# echo "your-misp-api-key" > .secrets/misp_key
echo "your-mailgun-key" > .secrets/mailgun_api
```

If `.secrets/field_key` already exists but is empty, regenerate it before starting Docker:

```bash
./setup_field_encryption_key.sh --force
```

### 4. Configure environment

- **Recommended:** Edit [.env](.env) from [.env.template](.env.template)
- Optional: export environment variables in your shell to override `.env` values for a single run
- Keep secrets in Docker secrets under `/run/secrets/*` (do not put secrets in `.env`)

Key variables:

```bash
PUBLIC_BASE_URL=https://your.domain.com
FRONTEND_URL=https://your.domain.com
CORS_ALLOWED_ORIGINS=https://your.domain.com
CSRF_TRUSTED_ORIGINS=https://your.domain.com
SERVER_DOMAIN=your.domain.com
ADMIN_ALLOWED_IP_RANGES=192.168.1.0/24
```

### 5. Start the platform

```bash
docker compose up -d
```

### 6. Run migrations and create superuser

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

### 7. Import MITRE ATT&CK data

```bash
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote
```

### 8. Access the platform

- Web UI: `https://your.domain.com`
- GraphQL API: `https://your.domain.com/graphql`
- Admin Panel: `https://your.domain.com/admin`

---

## 🔧 Configuration

### Environment Variables

For the complete, up-to-date variable catalog (including advanced/optional keys), see [Docs/ENVIRONMENT_VARIABLES.md](Docs/ENVIRONMENT_VARIABLES.md).

| Variable | Description | Required |
|----------|-------------|----------|
| `DEBUG` | Enable debug mode | No (default: False) |
| `SECRET_KEY` | Django secret key | Yes (auto-generated if empty) |
| `SERVER_DOMAIN` | Your domain or IP | Yes |
| `FRONTEND_URL` | Frontend base URL for emails | No (default: https://localhost) |
| `PUBLIC_BASE_URL` | Canonical external base URL for shareable links (for multi-proxy deployments) | No (default: unset; backend tries request host, then FRONTEND_URL) |
| `WEBAUTHN_RP_ID` | WebAuthn relying party ID (public host) | Yes for security-key MFA/passwordless |
| `WEBAUTHN_ORIGIN` | WebAuthn origin (must be HTTPS in production) | Yes for security-key MFA/passwordless |
| `CORS_ALLOWED_ORIGINS` | Additional allowed CORS origins (comma-separated). `mitre-attack.github.io` is always included automatically. | No |
| `CSRF_TRUSTED_ORIGINS` | Trusted CSRF origins (comma-separated, must include your public URL) | No (default: https://localhost,http://localhost) |
| `ADMIN_ALLOWED_IP_RANGES` | IP ranges allowed to access /admin/ (comma-separated CIDR) | No (default: localhost + Docker networks) |
| `DB_HOST` | PostgreSQL host | No (default: db) |
| `DB_PORT` | PostgreSQL port | No (default: 5432) |
| `DB_NAME` | Database name | No (default: hefaistos_db) |
| `DB_USER` | Database user | No (default: hefaistos_user) |
| `DB_PASSWORD_FILE` | Docker secret file path for DB password | No (default: /run/secrets/db_password) |
| `RABBITMQ_HOST` | RabbitMQ host | No (default: rabbitmq) |
| `RABBITMQ_PORT` | RabbitMQ port | No (default: 5672) |
| `RABBITMQ_USER` | RabbitMQ username | No (default: hefaistos_mq) |
| `RABBITMQ_PASS_FILE` | Docker secret file path for RabbitMQ password | No (default: /run/secrets/rabbitmq_pass) |
| `ELASTICSEARCH_HOST` | Elasticsearch host | No (default: elasticsearch) |
| `ELASTICSEARCH_PORT` | Elasticsearch port | No (default: 9200) |
| `FIELD_ENCRYPTION_KEY_PATH` | Path to Fernet key | No (default: /run/secrets/field_key) |
| `FIELD_ENCRYPTION_KEY_FILE` | Docker secret file path for Fernet key | No (default: /run/secrets/field_key) |
| `MISP_URL` | MISP URL for **threat_intel_connector** only (ADVOPS push uses per-org instances configured via UI) | No |
| `HEFAISTOS_API_URL` | API base URL used by connector containers | No (default: http://backend:8000/graphql) |
| `HEFAISTOS_API_TOKEN_FILE` | Connector service token file path | No (default: /run/connector/token.jwt) |
| `EMAIL_ENABLED` | Enable email notifications | No (default: False) |
| `EMAIL_HOST` | SMTP host | No |
| `EMAIL_PORT` | SMTP port | No |
| `EMAIL_HOST_USER` | SMTP username | No |
| `MAILGUN_API_KEY_PATH` | Path to Mailgun API key | No |
| `BACKUP_ENABLED` | Enable backups | No (default: False) |
| `BACKUP_SCHEDULE` | Cron schedule | No (default: 0 2 * * *) |
| `BACKUP_RETENTION_DAYS` | Keep backups for N days | No (default: 30) |

### Docker Secrets

Production deployments should use Docker secrets:

```yaml
secrets:
  db_password:
    file: ./.secrets/db_password
  rabbitmq_pass:
    file: ./.secrets/rabbitmq_pass
  field_key:
    file: ./.secrets/field_key
  # misp_key is only required if using the threat_intel_connector
  misp_key:
    file: ./.secrets/misp_key
  mailgun_api:
    file: ./.secrets/mailgun_api
```

### CORS & Security Key (YubiKey/WebAuthn) Setup

CORS/CSRF and WebAuthn are configured through `.env` values (loaded by Compose via `env_file`). `.env.template` is the starter template.

#### For users

To enroll a YubiKey/security key, users only need the UI:

1. Log in to HEFAISTOS.
2. Open **User Profile**.
3. Find **Security Keys (YubiKey/WebAuthn)**.
4. Optionally enter a key name.
5. Click **Add Security Key**.
6. Touch/confirm the YubiKey when the browser prompts.
7. Enrollment is complete.

Users do **not** need to edit `.env`, Docker Compose, or any server-side settings.

#### For administrators/operators (one-time platform setup)

Configure these values in `.env`:

```bash
FRONTEND_URL=https://detect.hefaistos.org
PUBLIC_BASE_URL=https://detect.hefaistos.org
WEBAUTHN_RP_ID=detect.hefaistos.org
WEBAUTHN_ORIGIN=https://detect.hefaistos.org
```

`PUBLIC_BASE_URL` is recommended when your deployment has multiple proxy layers (for example: External LB/Proxy -> Nginx -> frontend/backend containers). It ensures generated share URLs use the real externally reachable origin.

Also set CORS/CSRF values in `.env` (`CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`).

After updating `.env`, restart the services that consume these values:
```bash
docker compose up -d --force-recreate backend scheduler opentide-hef-publish-worker opentide-hef-import-worker listener ai_generation_worker opentide_enrichment_worker
```

> **Note:** Since the frontend and backend are both served by the same Nginx proxy on the same origin, CORS between them is not required. `CORS_ALLOWED_ORIGINS` is only needed for external tools (such as the ATT&CK Navigator at `mitre-attack.github.io`) that need to fetch data from the API.

**Media CORS**: Media files (avatars, snapshots) are served directly by Nginx with open CORS headers by default (`Access-Control-Allow-Origin: *`), so avatars load from any origin without configuration. If you need to restrict this, modify the `/media/` location block in `nginx/conf.d/hefaistos.conf`.

---

### SSL/TLS Configuration

Place certificates in `nginx/certs/`:

- `nginx/certs/hefaistos.crt` - SSL certificate
- `nginx/certs/hefaistos.key` - SSL private key

Self-signed certificates can be generated:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/hefaistos.key \
  -out nginx/certs/hefaistos.crt \
  -subj "/CN=localhost"
```

---

## 👤 User Roles

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full access: user management, organization settings, Git operations, all CRUD |
| **REVIEWER** | Review and approve playbooks, push to Git, manage rules |
| **ANALYST** | Create/edit playbooks and rules, submit for review |
| **VIEWER** | Read-only access to playbooks, rules, and dashboards |

### Setting User Roles

Via Django Admin:

```bash
docker compose exec backend python manage.py shell
>>> from identity.models import CustomUser
>>> user = CustomUser.objects.get(username='analyst1')
>>> user.role = 'ADMIN'  # or 'ANALYST', 'REVIEWER', 'VIEWER'
>>> user.save()
```

---

## 🔌 Event-Driven Connectors

HEFAISTOS uses RabbitMQ for event-driven integrations:

### Rule Connector

Synchronizes detection rules from Git repositories.

- **Trigger:** `rule.repo.pull.requested`
- **Function:** Clone repo, parse KQL/SPL/WAZUH files, upsert rules

### Notification Connector

Creates in-app notifications from domain events.

- **Events:** Review requests, approvals, rule creation, status changes
- **Channels:** In-app, email (configurable per user)

### Threat Intel Connector

Integrates with MISP threat intelligence platform.

- **Trigger:** Polling interval (configurable)
- **Function:** Import events, extract IoCs, create workbenches

### Git Push Connector

Exports playbooks to Git repositories as detection rules.

- **Trigger:** `playbook.git.push.requested`
- **Function:** Format rule (KQL/SPL/WAZUH), create branch, push, optionally open PR

### Deploy Connector

Handles deployment workflow transitions.

- **Trigger:** `playbook.deploy.requested`
- **Function:** Update playbook status to DEPLOYED

---

## ⚠️ Breaking Changes

### SIGMA format removed (2026)

SIGMA/Sigma YAML is no longer supported as a detection rule format in HEFAISTOS.

**What changed:**
- `SIGMA` removed from all rule format choices, selectors, and API fields
- `sigconverter` service removed from `docker-compose.yml` (port 7002)
- pySigma Python packages removed from backend dependencies
- `StartGenerateSigmaTask` GraphQL mutation renamed to `StartGenerateRuleTask`
- `GenerateSigmaAI` GraphQL mutation removed
- Rule conversion UI (pySigma backend conversion) removed
- `rules/sigma` Git push folder option removed

**Migration steps after `git pull`:**

1. Rebuild and restart all containers:
   ```bash
   docker compose down
   docker compose pull
   docker compose up -d --build
   ```

2. Apply database migrations (remaps existing SIGMA rules → OTHER format):
   ```bash
   docker compose exec backend python manage.py migrate
   ```

3. Clean up your environment:
   - Remove `LSP_SIGMA_*`, `SIGCONVERTER_*` variables from `.env` / deployment configs
   - Remove any SIGMA-specific automation from your deployment pipeline

4. Verify service health — backend, worker, frontend, and remaining LSP services (KQL/SPL/WAZUH/AQL) should all start cleanly.

5. Review legacy SIGMA rules:
   - Existing rules with `format=SIGMA` have been automatically remapped to `format=OTHER` by the migration
   - Recreate affected rules in a supported format (KQL, SPL, WAZUH) if needed

**Supported formats going forward:** KQL, SPL, WAZUH, EQL, ELASTIC, OTHER

---

## 📖 API Reference

### GraphQL Endpoint

`POST /graphql`

**Authentication:** Bearer token (JWT)

```bash
curl -X POST https://localhost/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ me { id username role } }"}'
```

### Key Queries

```graphql
# Get current user
query { 
  me { 
    id 
    username 
    email 
    role 
    organization { name } 
  } 
}

# List playbook graphs
query { 
  allPlaybookGraphs { 
    id 
    title 
    status 
    author { username } 
  } 
}

# Search rules
query { 
  rulesConnection(search: "mimikatz", first: 10) { 
    edges { 
      node { 
        id 
        title 
        format 
        rawContent 
      } 
    } 
    totalCount 
  }
}

# Get MITRE technique suggestions
query { 
  detectionSuggestions(techniqueId: "T1003") { 
    technique { 
      id 
      name 
    }
    strategies { 
      id 
      name 
      analytics { 
        name 
        description 
      } 
    }
  }
}
```

### Key Mutations

```graphql
# Create playbook graph
mutation { 
  createPlaybookGraph(title: "New Detection") { 
    graph { id } 
  } 
}

# Generate AI rule
mutation { 
  startGenerateRuleTask(outputFormat: "KQL") { 
    taskId 
  } 
}

# Submit for review
mutation { 
  requestReview(graphId: "uuid") { 
    success 
    message 
  } 
}

# Approve review
mutation { 
  approveReview(reviewId: "uuid") { 
    success 
  } 
}
```

---

## 🧪 Development

### Local Development Setup

1. **Backend:**

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

2. **Frontend:**

```bash
cd frontend
npm install
npm start
```

3. **Services (Docker):**

```bash
docker compose up -d db rabbitmq elasticsearch
```

### Running Tests

```bash
# Backend tests
docker compose exec backend python manage.py test

# Frontend tests
docker compose exec frontend npm test

# Coverage report
cd backend && coverage run --source='.' manage.py test && coverage report
```

### Database Migrations

```bash
# Create new migration
cd backend && python manage.py makemigrations app_name

# Apply migrations
python manage.py migrate

# Check migration status
python manage.py showmigrations
```

### GraphQL Debugging

Interactive GraphQL playground:

- Via NGINX proxy (Compose): `http://localhost/graphql` or `https://localhost/graphql`
- Direct backend (when running `manage.py runserver`): `http://localhost:8000/graphql`

See [DEBUG_GRAPHQL.md](Docs/DEBUG_GRAPHQL.md) for detailed query examples.

### Code Style

- **Backend:** Black, isort, flake8
- **Frontend:** ESLint, Prettier

---

## 📁 Project Structure

```
hefaistos/
├── backend/                    # Django backend
│   ├── core/                   # Core settings, schema, middleware
│   ├── identity/               # User auth, profiles, RBAC
│   ├── organizations/          # Multi-tenant organization management
│   ├── playbooks/              # Detection playbooks and graphs
│   ├── rules/                  # Detection rule management
│   ├── ach/                    # Analysis of Competing Hypotheses
│   ├── ai_assistant/           # AI integration engine
│   ├── platform_data/          # MITRE ATT&CK data
│   ├── knowledge/              # Knowledge base
│   ├── data_catalog/           # Data source catalog
│   ├── log_catalog/            # Log source management
│   ├── review/                 # Peer review workflow
│   ├── notifications/          # Notification system
│   ├── news/                   # Announcements
│   ├── tags/                   # Tagging system
│   └── services/               # Event listener service
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components (incl. CapabilityAbstractionMapNode, TechniqueRootNode, CoverageGapNode, CapabilityAbstractionLayerBands)
│   │   ├── pages/              # Page components
│   │   ├── context/            # React context providers
│   │   └── utils/              # Utility functions (incl. capabilityAbstractionUtils)
│   └── public/                 # Static assets
├── hefaistos-sdk/              # Python SDK for connectors
├── rule_connector/             # Git rule sync connector
├── notification_connector/     # Notification connector
├── threat_intel_connector/     # MISP integration connector
├── git_push_connector/         # Git export connector
├── deploy_connector/           # Deployment connector
├── nginx/                      # Nginx configuration
├── scripts/                    # Utility scripts
├── attack-navigator/           # MITRE Navigator static build
├── Docs/                       # Additional documentation
├── docker-compose.yml          # Docker orchestration
└── README.md                   # This file
```

---

## ⚙️ Maintenance & Operations

### Backup & Restore

Automated backups are configured during installation:

```bash
# Manual backup
./scripts/backup-hefaistos.sh

# Restore from backup
./scripts/backup-hefaistos.sh --restore /path/to/backup.tar.gz
```

Backups include:

- PostgreSQL database dump (gzip compressed)
- Configuration files and secrets
- Integrity verification checksums
- Automatic rotation with 30-day retention (configurable)

**See:** [scripts/backup-hefaistos.sh](scripts/backup-hefaistos.sh)

### Uninstall & Rollback

To safely remove HEFAISTOS:

```bash
# Interactive uninstall with options
./scripts/uninstall-hefaistos.sh

# Keep data and backups (rollback-friendly)
./scripts/uninstall-hefaistos.sh --keep-data --keep-backups

# Full cleanup (use with caution)
./scripts/uninstall-hefaistos.sh --full-cleanup
```

**See:** [scripts/uninstall-hefaistos.sh](scripts/uninstall-hefaistos.sh)

### Firewall Configuration

Configure UFW firewall:

```bash
# Interactive firewall setup
./scripts/setup-firewall.sh

# View firewall rules
sudo ufw status verbose

# Manual rule examples (NGINX public ports)
sudo ufw allow from 192.168.0.0/16 to any port 443
sudo ufw allow from 192.168.0.0/16 to any port 80
```

**See:** [scripts/setup-firewall.sh](scripts/setup-firewall.sh)

### Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose stop

# Restart specific service
docker compose restart backend

# View backend logs
docker compose logs -f backend

# Access backend shell
docker compose exec backend bash
```

---

## 🔒 Security Considerations

- **Authentication:** JWT tokens with configurable expiration
- **Authorization:** Role-based access control (RBAC)
- **Encryption:** Fernet encryption for sensitive fields (API keys, tokens)
- **Secrets:** Docker secrets for production credentials
- **Network:** Internal Docker network isolation
- **HTTPS:** TLS termination at Nginx reverse proxy
- **CORS:** Configurable allowed origins

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Proprietary - All rights reserved.

---

## 📞 Support

For support and inquiries:

- Open an issue in the GitHub repository
- Contact the HEFAISTOS team

---

<div align="center">

**Built with ❤️ for Detection Engineers**

</div>

**(c) 2026 Jan Pohl a.k.a. M3C4N1SM0 & A Collective Hallucination of AI Bots**

All rights reserved © 2026. Proceed at your own risk. The author assumes no responsibility for any detection rules generated by AI, security breaches caused by "collaborative AI suggestions," or your career if this breaks your production environment.
