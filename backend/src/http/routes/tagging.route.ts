import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { UserRole } from '@prisma/client';
import {
    addTags,
    removeTags,
    setTags,
    search,
    create,
} from '../controllers/tagging.controller';

export const taggingRouter = Router();

taggingRouter.get('/tags/search', search);

taggingRouter.post(
    '/tags',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    create
);

taggingRouter.post(
    '/media/:id/tags',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    setTags
);

taggingRouter.post(
    '/media/:id/tags/add',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    addTags
);

taggingRouter.post(
    '/media/:id/tags/remove',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    removeTags
);
