import { Router } from 'express';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { asyncHandler } from '../utils/asyncHandler';

export const storageRouter = Router();

storageRouter.get(
    '/storage/ping',
    asyncHandler(async (_req, res) => {
        const exists = await minio.bucketExists(env.MINIO_BUCKET);

        res.json({
            status: 'ok',
            bucket: env.MINIO_BUCKET,
            exists,
        });
    })
);
