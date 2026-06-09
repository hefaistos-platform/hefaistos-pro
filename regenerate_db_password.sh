#!/bin/bash
# Regenerate database password and reset the database

set -e

echo "=== Hefaistos Database Password Regeneration ==="
echo ""

# Generate new secure password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

echo "New password generated: ${NEW_PASSWORD:0:8}********"
echo ""

# Create secrets directory if it doesn't exist
mkdir -p .secrets

# Backup old password
if [ -f .secrets/db_password ]; then
    cp .secrets/db_password .secrets/db_password.backup
    echo "✓ Old password backed up to .secrets/db_password.backup"
fi

# Write new password
echo -n "$NEW_PASSWORD" > .secrets/db_password
echo "✓ New password written to .secrets/db_password"
echo ""

echo "=== Resetting Database ==="
echo "This will:"
echo "  1. Stop all services"
echo "  2. Remove database volume (all data will be lost)"
echo "  3. Restart services with new password"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted. Old password restored."
    if [ -f .secrets/db_password.backup ]; then
        mv .secrets/db_password.backup .secrets/db_password
    fi
    exit 1
fi

echo ""
echo "Stopping services..."
docker-compose down

echo "Removing database volume..."
docker volume rm hefaistos_postgres_data || true

echo "Starting services..."
docker-compose up -d

echo ""
echo "=== Done! ==="
echo "Database password has been regenerated."
echo "Services are starting up with the new password."
echo ""
echo "Monitor startup with:"
echo "  docker-compose logs -f backend"
