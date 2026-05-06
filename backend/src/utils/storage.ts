import { env } from '../config/env';
import { minio } from '../lib/minio';

export async function presignObject(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
    );
}

export async function removeObjectsQuiet(keys: Array<string | null | undefined>) {
    await Promise.all(
        keys
            .filter((key): key is string => typeof key === 'string' && key.length > 0)
            .map((key) => minio.removeObject(env.MINIO_BUCKET, key).catch(() => {})),
    );
}
