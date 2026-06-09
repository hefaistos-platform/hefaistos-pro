# SyntaxTide LSP Server Deployment

## Overview

HEFAISTOS includes Language Server Protocol (LSP) servers for real-time syntax validation and
autocomplete in detection rule editors. These servers are powered by
[SyntaxTide](https://github.com/OpenTideHQ/SyntaxTide) and run alongside the Django backend.

## Architecture

| Language | Port | Description |
|----------|------|-------------|
| KQL      | 7000 | Microsoft Sentinel / Defender Kusto Query Language |
| SPL      | 7001 | Splunk Search Processing Language |
| SIGMA    | 7002 | SIGMA YAML detection rules |

## Automatic Startup

LSP servers start automatically when the backend container starts via `run_backend.py`, provided
that the `ENABLE_LSP_SERVERS` environment variable is set to `true` (the default in
`docker-compose.yml`).

The startup sequence is:

1. Docker secrets are loaded.
2. Django migrations run with retry.
3. Connector JWT token is generated.
4. LSP servers are started (SyntaxTide is cloned/updated and Node.js dependencies are installed).
5. The Django development server starts.

If any LSP server fails to start, the backend continues normally and the editor falls back to
GraphQL-based autocomplete.

## Requirements

- **Node.js and npm** must be available in the backend container. The `backend/Dockerfile` installs
  them automatically.
- Network access to clone `https://github.com/OpenTideHQ/SyntaxTide.git` during the first startup.

## Manual Control

```bash
# Start all LSP servers
docker compose exec backend python manage.py start_lsp_servers --language all

# Start an individual server
docker compose exec backend python manage.py start_lsp_servers --language kql

# Check status from Django shell
docker compose exec backend python manage.py shell
>>> from lsp_server.manager import get_lsp_manager
>>> get_lsp_manager().get_status()
```

## Disabling LSP Servers

Set `ENABLE_LSP_SERVERS=false` (or remove the variable) in `docker-compose.yml` to skip LSP
startup entirely. The editor will fall back to GraphQL-based autocomplete.

## Troubleshooting

### "LSP connection failed" in browser console

Check that Node.js is available and that SyntaxTide was cloned successfully:

```bash
docker compose exec backend node --version
docker compose exec backend ls /app/syntaxtide
docker compose logs backend | grep -i lsp
```

### Ports 7000–7002 already in use

Change the host-side port mappings in `docker-compose.yml`:

```yaml
ports:
  - "17000:7000"  # map host port 17000 to container port 7000
  - "17001:7001"
  - "17002:7002"
```

Update the corresponding LSP WebSocket URLs in the frontend if you change the host ports.

### SyntaxTide clone fails

- Verify that the backend container has outbound internet access.
- Check the GitHub URL in `backend/lsp_server/manager.py` (`syntaxtide_repo_url`).
