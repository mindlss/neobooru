import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { viewerMiddleware } from '../middlewares/viewer.middleware';
import { UserRole } from '@prisma/client';
import {
    addTags,
    removeTags,
    setTags,
    search,
    popular,
    create,
    patch,
    createTagAlias,
    deleteTagAlias,
    listTagAliases,
} from '../controllers/tagging.controller';

export const taggingRouter = Router();

// public (viewer-aware)
taggingRouter.get(
    '/tags/search',
    optionalAuthMiddleware,
    viewerMiddleware,
    search
);
taggingRouter.get(
    '/tags/popular',
    optionalAuthMiddleware,
    viewerMiddleware,
    popular
);

// admin/mod
taggingRouter.post(
    '/tags',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    create
);

taggingRouter.patch(
    '/tags/:id',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    patch
);

// aliases (admin/mod)
taggingRouter.get(
    '/tags/:id/aliases',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    listTagAliases
);

taggingRouter.post(
    '/tags/:id/aliases',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    createTagAlias
);

taggingRouter.delete(
    '/tags/aliases/:id',
    authMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    deleteTagAlias
);

// media tags set/add/remove (admin/mod)
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
