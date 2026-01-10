import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { UserRole } from '@prisma/client';
import { listJobs, runJob } from '../controllers/jobs.controller';

export const jobsRouter = Router();

jobsRouter.get(
    '/jobs',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    listJobs
);

jobsRouter.post(
    '/jobs/:name/run',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    runJob
);
