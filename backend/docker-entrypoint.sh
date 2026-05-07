#!/usr/bin/env sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

exec "$@"
