#!/usr/bin/env bash
set -e

echo "▶ Starting Docker services..."
docker compose -f ../docker/docker-compose.dev.yml up -d

echo "▶ Waiting for Postgres..."
sleep 5  # простое ожидание, для dev хватает

# echo "▶ Starting backend..."
# cd backend
# npm run dev
