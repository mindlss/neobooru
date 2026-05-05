import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import dotenv from 'dotenv';

function loadTestEnv() {
    const envFile = resolve(process.cwd(), '.env.test');
    if (existsSync(envFile)) {
        dotenv.config({ path: envFile, override: true });
    } else {
        dotenv.config();
    }

    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL ??= 'silent';
    process.env.LOG_TO_FILE ??= 'false';
    process.env.JWT_SECRET ??= 'test-access-secret-32-characters-min';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-32-characters-min';
    process.env.JWT_EXPIRES_IN ??= '60';
    process.env.JWT_REFRESH_EXPIRES_IN ??= '300';
    process.env.REDIS_HOST ??= 'localhost';
    process.env.REDIS_PORT ??= '6379';
    process.env.REDIS_DB ??= '1';
    process.env.MINIO_ENDPOINT ??= 'localhost';
    process.env.MINIO_PORT ??= '9000';
    process.env.MINIO_USE_SSL ??= 'false';
    process.env.MINIO_ACCESS_KEY ??= 'test';
    process.env.MINIO_SECRET_KEY ??= 'test';
    process.env.MINIO_BUCKET ??= 'media-test';
}

export default function globalSetup() {
    loadTestEnv();

    if (!process.env.DATABASE_URL) {
        throw new Error(
            'DATABASE_URL is required for integration tests. Create .env.test from .env.test.example.',
        );
    }

    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        throw new Error('Failed to apply Prisma migrations for tests.');
    }
}
