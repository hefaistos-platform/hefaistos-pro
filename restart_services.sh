#!/bin/bash

# Restart Docker services to fix 502 Bad Gateway

echo "Stopping all services..."
docker compose down

echo "Waiting 5 seconds..."
sleep 5

echo "Rebuilding backend without cache..."
docker compose build backend --no-cache

echo "Starting all services..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 10

echo "Checking service status..."
docker compose ps

echo "Done! Check if services are running and healthy."
