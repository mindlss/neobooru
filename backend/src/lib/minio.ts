import { Client } from 'minio';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const minio = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL === 'true',
    region: env.MINIO_REGION,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

const publicMinio = new Client({
    endPoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
    port: env.MINIO_PUBLIC_PORT ?? env.MINIO_PORT,
    useSSL: (env.MINIO_PUBLIC_USE_SSL ?? env.MINIO_USE_SSL) === 'true',
    region: env.MINIO_REGION,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

export async function presignObject(key: string) {
    return publicMinio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
    );
}

export async function ensureBucket() {
    const exists = await minio.bucketExists(env.MINIO_BUCKET);

    if (!exists) {
        logger.info(
            { bucket: env.MINIO_BUCKET },
            'MinIO bucket not found, creating...'
        );
        await minio.makeBucket(env.MINIO_BUCKET);
        logger.info({ bucket: env.MINIO_BUCKET }, 'MinIO bucket created');
    } else {
        logger.info({ bucket: env.MINIO_BUCKET }, 'MinIO bucket exists');
    }
}
