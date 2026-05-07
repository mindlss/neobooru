# NeoBooru Docker

## Local production-like stack

```bash
cp docker/.env.example docker/.env
docker compose --env-file docker/.env -f docker/docker-compose.yml up --build
```

Open:

- App: `http://localhost:8080`
- Backend health: `http://localhost:3000/health`
- MinIO console: `http://localhost:9001`

The backend runs `prisma migrate deploy` on startup by default. Set
`RUN_MIGRATIONS=false` if migrations are handled separately.

## First admin

On startup the backend ensures RBAC tables exist and creates the first admin
from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME`, and `SEED_ADMIN_PASSWORD` only
when there is no user with the `admin` role yet. Change these values in
`docker/.env` before exposing the stack.

Newly registered users receive the system `user` role. It includes regular
account permissions such as uploads, comments, ratings, favorites, reports, own
media usage, and own media tag edits, but does not include admin/staff
permissions.

## Public URLs

`PUBLIC_APP_URL` is used for `sitemap.xml` and `robots.txt`.

MinIO has two endpoint groups:

- `MINIO_ENDPOINT=minio` is internal Docker networking for backend storage calls.
- `MINIO_PUBLIC_ENDPOINT=localhost` is used for browser-facing presigned URLs.
- `MINIO_REGION=us-east-1` lets the backend sign browser URLs without asking the
  public endpoint for bucket location from inside the container.

For a real deployment, point `PUBLIC_APP_URL` and `MINIO_PUBLIC_*` at externally
reachable HTTPS hosts.
