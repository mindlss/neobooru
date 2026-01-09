import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
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
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    getQueue
);

moderationRouter.post(
    '/moderation/media/:id/approve',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    approve
);

moderationRouter.post(
    '/moderation/media/:id/reject',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    reject
);
