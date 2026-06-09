#!/bin/bash
# Script to test GraphQL authentication end-to-end
# This should be run from the backend container or host

echo "=========================================="
echo "GraphQL Authentication End-to-End Test"
echo "=========================================="

BASE_URL="http://backend:8000"

echo ""
echo "[1] Check Django migrations..."
docker compose exec backend python manage.py showmigrations identity

echo ""
echo "[2] Create/verify connector user..."
docker compose exec backend python manage.py shell << 'PYEOF'
from django.contrib.auth import get_user_model
from organizations.models import Organization

User = get_user_model()

# Check or create connector user
try:
    connector = User.objects.get(username='connector')
    print(f"✓ Connector user exists: {connector}")
except User.DoesNotExist:
    org, _ = Organization.objects.get_or_create(name='System')
    connector = User.objects.create_user(
        username='connector',
        password='changeme',
        email='connector@system.local',
        organization=org
    )
    print(f"✓ Created connector user")
PYEOF

echo ""
echo "[3] Test REST /api/token/ endpoint..."
docker compose exec deploy_connector curl -X POST \
  http://backend:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"connector","password":"changeme"}' 2>/dev/null | jq .

echo ""
echo "[4] Extract token and test GraphQL..."
TOKEN=$(docker compose exec -T deploy_connector curl -s -X POST \
  http://backend:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"connector","password":"changeme"}' | jq -r '.access')

echo "Token: ${TOKEN:0:50}..."

echo ""
echo "[5] Query GraphQL with token..."
docker compose exec deploy_connector curl -X POST \
  http://backend:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"query":"{ me { username organization { name } } }"}' 2>/dev/null | jq .

echo ""
echo "=========================================="
