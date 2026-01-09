import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';

export const dbRouter = Router();

dbRouter.get(
    '/db/ping',
    asyncHandler(async (_req, res) => {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    })
);
