# Setup Instructions for Hefaistos Deploy Connector

The deploy connector now reads its JWT from a shared volume, not from a plain environment variable. You do not need to paste the token into docker-compose. The backend generates and writes the token to a file that connectors read.

Key paths and variables used in docker-compose:
- Token file volume: `/run/connector/token.jwt` (shared via the `connector-token` volume)
- Backend writes token to: `/run/connector/token.jwt`
- Connectors read token via: `HEFAISTOS_API_TOKEN_FILE=/run/connector/token.jwt`
- Other sensitive secrets (DB/RabbitMQ/etc.) live under `/run/secrets` (different path from the token)

## Step 1: Start the Environment

```bash
docker compose down
docker compose up -d
```

This will:
- Start all services (backend, db, rabbitmq, elasticsearch, etc.)
- Run Django migrations automatically
- Create the `connector_svc` user
- Generate and write the connector JWT to `/run/connector/token.jwt`

Wait until the backend is healthy (it checks GraphQL and that the token file exists):

```bash
docker compose ps
```

The backend should show "healthy" before proceeding.

## Step 2: (Optional) Regenerate the JWT Token

If you need to rotate the token, run:

```bash
docker compose exec backend python manage.py generate_connector_token
```

The command prints the token and ensures the current value is written to `/run/connector/token.jwt` in the shared volume. Connectors that read the file on startup will pick up the new token after a restart.

To restart just the deploy connector:

```bash
docker compose restart deploy_connector
```

## Step 3: Verify Authentication Works

Open a shell in the deploy connector container:

```bash
docker compose exec deploy_connector bash
```

Inside the container, install curl and jq if missing:

```bash
apt-get update && apt-get install -y curl jq
```

Use the token file to call GraphQL:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat $HEFAISTOS_API_TOKEN_FILE)" \
  -d '{"query": "query { me { username organization { name } } }"}' \
  "$HEFAISTOS_API_URL" | jq
```

**Expected Success Response:**

```json
{
  "data": {
    "me": {
      "username": "connector_svc",
      "organization": { "name": "System" }
    }
  }
}
```

If you see this response, authentication is working! ✓

## Alternative: Use Python Test Script

Run the built-in test from the container:

```bash
docker compose exec deploy_connector python test_auth.py
```

This runs an automated check using the token file.

## Troubleshooting

### Token file not found

- Ensure the backend is healthy and the shared volume is mounted.
- The token file should be at `/run/connector/token.jwt` inside both `backend` and `deploy_connector` containers.
- Restart the backend to re-create the token file if needed:

```bash
docker compose restart backend
```

### "Invalid payload" or authentication fails

- Regenerate and rewrite the token file:

```bash
docker compose exec backend python manage.py generate_connector_token
docker compose restart deploy_connector
```

### curl: command not found

Install tools inside the container:

```bash
apt-get update && apt-get install -y curl jq
```

### Connection refused to backend

Confirm services are up and healthy:

```bash
docker compose ps
```

Note: Secrets like database and RabbitMQ passwords are mounted under `/run/secrets`. The JWT token for connectors is intentionally stored in the separate shared path `/run/connector`.
