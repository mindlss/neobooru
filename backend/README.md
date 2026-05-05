# NeoBooru Backend

Express + TypeScript backend for a booru-style media application. The API is generated with tsoa, data is stored in PostgreSQL through Prisma, media files live in MinIO, and Redis is used for short-lived auth state such as token revocation.

## Stack

- Node.js + TypeScript, CommonJS modules
- Express 4 with tsoa-generated routes and OpenAPI
- Prisma + PostgreSQL
- Redis via ioredis
- MinIO for object storage
- Vitest + Supertest integration tests
- Pino logging

## Prerequisites

- Node.js 22+
- npm
- Docker and Docker Compose

## Setup

Install dependencies:

```bash
npm install
```

Create local env files:

```bash
cp .env.example .env
cp .env.test.example .env.test
```

The development docker compose file uses:

- PostgreSQL: `localhost:5432`, user `admin`, password `admin123`, database `neobooru`
- Redis: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO console: `localhost:9001`
- Adminer: `localhost:8080`
- RedisInsight: `localhost:8001`

For tests, point `.env.test` at a separate database, for example:

```env
DATABASE_URL=postgresql://admin:admin123@localhost:5432/neobooru_test?schema=public
```

Create that database once before the first test run.

## Development

Start infrastructure:

```bash
npm run docker
```

Apply migrations and generate Prisma client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

Optional seed for local users, roles, permissions, and default tags:

```bash
npm run prisma:seed
```

Start the dev server:

```bash
npm run dev
```

`npm run dev` regenerates tsoa routes/spec before launching `src/server.ts` in watch mode.

OpenAPI docs are available at:

```text
http://localhost:3000/docs
```

## Scripts

```bash
npm run docker            # start Postgres, Redis, MinIO, Adminer, RedisInsight
npm run tsoa:gen          # regenerate src/generated/routes.ts and swagger.json
npm run dev               # generate tsoa artifacts and run the server in watch mode
npm run build             # TypeScript build into dist/
npm start                 # run built server
npm test                  # run integration tests
npm run test:watch        # run tests in watch mode
npm run prisma:generate   # regenerate Prisma client
npm run prisma:migrate    # create/apply dev migration
npm run prisma:studio     # open Prisma Studio
npm run prisma:seed       # seed roles, permissions, users, and tags
```

## Tests

Integration tests live under `src/tests/integration`. They boot the Express app in-process with Supertest, apply Prisma migrations in global setup, truncate all public tables except `_prisma_migrations` before each test, and mock Redis in memory.

Run:

```bash
npm test
```

The test database must be reachable through `DATABASE_URL` from `.env.test`. Tests intentionally use a separate DB because cleanup truncates application tables.

## Project Layout

```text
src/app.ts                 Express app factory
src/server.ts              production/dev server bootstrap
src/config/                env parsing and logging
src/domain/                business logic by feature area
src/http/controllers/      tsoa controllers
src/http/dto/              API response/request DTO types
src/http/schemas/          Zod runtime validation schemas
src/http/tsoa/             auth integration and controller guards
src/generated/             generated tsoa routes and OpenAPI spec
src/jobs/                  background jobs and runner
src/lib/                   Prisma, Redis, MinIO clients
src/tests/                 Vitest setup and integration tests
prisma/schema.prisma       database schema
prisma/migrations/         migration history
prisma/seed.ts             local seed data
docker/docker-compose.dev.yml
```

## API Notes

Authentication uses `accessToken` and `refreshToken` HTTP-only cookies. In non-production environments, `Authorization: Bearer <token>` is also accepted as a convenience for API clients.

Known errors should be thrown with `apiError(status, code, message, details?)`. The error middleware returns a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "requestId": "..."
  }
}
```

After changing controller decorators, DTOs, route parameters, or response shapes, regenerate and commit tsoa artifacts:

```bash
npm run tsoa:gen
```

## Configuration

All runtime configuration is validated in `src/config/env.ts`. Add new variables there instead of reading `process.env` directly in feature code. Keep `.env.example` and `.env.test.example` in sync when adding required settings.

Useful flags:

- `JOBS_ENABLED=false` disables the background runner.
- `JOBS_RUN_ON_START=false` prevents startup jobs.
- `LOG_TO_FILE=false` keeps logs out of `./logs`.
- `REDIS_DB=1` can isolate test Redis state if Redis is not mocked.
