# In-App System Update

HEFAISTOS PRO v1.5.16+

Operators can trigger a Docker Compose system update from the Configuration
page without running manual CLI commands.

---

## Authorization

**Superuser only.** The feature is restricted to Django superusers
(`is_superuser = True`). Regular organization admins cannot trigger updates
because this is a system-wide operation affecting all tenants.

Both the backend (GraphQL resolver guard) and the frontend (tab visibility +
UI state) enforce this independently.

---

## UI location

**Management → Configuration → System Update tab**  
(`/mgmt/config?tab=system-update`)

The tab is only visible when the logged-in user is a superuser.

---

## Update modes

### Standard (default – low downtime)

Recommended for routine updates. Services are restarted rolling-style.

```
docker compose pull
docker compose --profile batch run --rm migrate
docker compose --profile workers --profile obs --profile devtools up -d --build --remove-orphans
```

### Force (down/up – recovery only)

Brings all services down before restarting. Causes deliberate downtime.
Only use when a standard update fails or a clean restart is required.

```
docker compose down --remove-orphans
docker compose pull
docker compose --profile workers --profile obs --profile devtools up -d --build --remove-orphans
docker compose --profile batch run --rm migrate
```

---

## Safety controls

| Control | Details |
|---|---|
| Single-flight lock | Only one update job can run at a time. A second request while a job is active returns HTTP 409 / GraphQL error. |
| Command allowlist | Commands are hard-coded in `system_update/runner.py`. No user input reaches subprocess arguments. |
| No `shell=True` | All subprocess calls use argv lists. |
| Step timeout | Each step is bounded by `HEFAISTOS_UPDATE_STEP_TIMEOUT` (default 600 s). |
| Job timeout | Overall job is bounded by `HEFAISTOS_UPDATE_JOB_TIMEOUT` (default 1800 s). |
| Secret redaction | Log lines are scanned for patterns like `****** `token=`, `secret=`, etc. Values are replaced with `[REDACTED]` before storage. |
| Audit trail | Every update attempt (success and failure) is emitted via `mcs_logging.emit_security_event`. |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HEFAISTOS_UPDATE_STEP_TIMEOUT` | `600` | Per-step timeout in seconds |
| `HEFAISTOS_UPDATE_JOB_TIMEOUT` | `1800` | Overall job timeout in seconds |
| `HEFAISTOS_COMPOSE_DIR` | project root | Working directory for compose commands |
| `HEFAISTOS_COMPOSE_CMD` | `docker compose` | Compose command tokens (for example `docker compose`, `docker-compose`, or `/usr/bin/docker compose`) |
| `HEFAISTOS_VERSION` | `1.0` | Version string shown in the UI/API |

---

## GraphQL API

All operations require a valid JWT for a superuser account.

```graphql
# Check current version and update capability
query {
  systemUpdateInfo {
    currentVersion
    composeDir
    capable
    capabilityNote
  }
}

# Start an update (mode: "standard" or "force")
mutation {
  startSystemUpdate(mode: "standard") {
    jobId
    success
    message
  }
}

# Poll job status
query {
  systemUpdateJobStatus(jobId: "<uuid>") {
    status
    mode
    actor
    startedAt
    endedAt
    failedStep
    errorMessage
  }
}

# Get job logs
query {
  systemUpdateJobLogs(jobId: "<uuid>")
}
```

---

## Rollback / operational considerations

- The update runner does **not** implement automatic rollback. If an update
  fails mid-way, services may be in a mixed state.
- If a standard update fails, use **force mode** from the UI to bring
  everything down and restart cleanly.
- For manual recovery, SSH to the host and run the appropriate
  `docker compose` commands directly.
- Database migrations are applied as part of the update sequence. Ensure you
  have a database snapshot before major version upgrades.

---

## Runtime expectations

- The backend Django process must have access to the Docker socket or
  the configured compose executable (`HEFAISTOS_COMPOSE_CMD`) either on PATH
  or as an absolute path.
- `HEFAISTOS_COMPOSE_DIR` must point to the directory containing
  `docker-compose.yml`.
- The backend user/process must have permissions to run `docker compose`
  commands on the host.
- In most deployments the backend container has the host Docker socket mounted
  (`/var/run/docker.sock`) for this purpose.
