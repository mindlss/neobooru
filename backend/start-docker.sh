#!/usr/bin/env bash
set -e

echo "Starting Docker services..."
docker compose -f ./docker/docker-compose.dev.yml up -d
