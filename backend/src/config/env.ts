import 'dotenv/config';
import { z } from 'zod';

const LogIntervalSchema = z.string().regex(/^\d+(d|h|m|s|M)$/);
const LogSizeSchema = z.string().regex(/^\d+(B|K|M|G)$/);

const EnvSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),

    // ===== Jobs =====
    JOBS_ENABLED: z.enum(['true', 'false']).default('true'),
    JOBS_TICK_MS: z.coerce.number().int().positive().default(10_000),
    JOBS_RUN_ON_START: z.enum(['true', 'false']).default('true'),

    // ===== Logging =====
    LOG_DIR: z.string().default('./logs'),
    LOG_TO_FILE: z.enum(['true', 'false']).default('true'),

    // split files
    LOG_APP_FILE_BASENAME: z.string().default('app.log'),
    LOG_ACCESS_FILE_BASENAME: z.string().default('access.log'),
    LOG_ERROR_FILE_BASENAME: z.string().default('error.log'),

    LOG_ROTATE_INTERVAL: LogIntervalSchema.default('1d'),
    LOG_ROTATE_SIZE: LogSizeSchema.default('50M'),
    LOG_MAX_FILES: z.coerce.number().int().positive().default(14),

    DATABASE_URL: z.string().min(1),

    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    MINIO_PRESIGN_EXPIRES: z.coerce.number().int().positive().default(3600),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),

    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(104857600),

    // ===== Avatars =====
    AVATAR_TARGET_SIZE: z.coerce.number().int().positive().default(512),
    AVATAR_MAX_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(5 * 1024 * 1024),

    SEED_ADMIN_EMAIL: z.string().default('admin@local'),
    SEED_ADMIN_USERNAME: z.string().default('admin'),
    SEED_ADMIN_PASSWORD: z.string().default('admin12345'),
    SEED_TRUSTED_EMAIL: z.string().default('trusted@local'),
    SEED_TRUSTED_USERNAME: z.string().default('trusted'),
    SEED_TRUSTED_PASSWORD: z.string().default('trusted12345'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    console.error(
        '❌ Invalid environment variables:',
        parsed.error.flatten().fieldErrors
    );
    process.exit(1);
}

export const env = parsed.data;
