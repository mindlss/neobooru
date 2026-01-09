import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { UserRole } from '@prisma/client';
import {
    approve,
    getQueue,
    reject,
} from '../controllers/moderation.controller';

export const moderationRouter = Router();

moderationRouter.get(
    '/moderation/queue',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    getQueue
);

moderationRouter.post(
    '/moderation/media/:id/approve',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    approve
);

moderationRouter.post(
    '/moderation/media/:id/reject',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    reject
);
