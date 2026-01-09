import { Router } from 'express';
import { uploadMedia } from '../controllers/media.controller';
import { listMedia, getMedia } from '../controllers/mediaRead.controller';
import { favorite, unfavorite } from '../controllers/favorites.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType, UserRole } from '@prisma/client';

export const mediaRouter = Router();

mediaRouter.get('/media', optionalAuthMiddleware, listMedia);
mediaRouter.get('/media/:id', optionalAuthMiddleware, getMedia);

mediaRouter.post(
    '/media/upload',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.TRUSTED, UserRole.MODERATOR, UserRole.ADMIN),
    requireNoActiveRestriction(
        RestrictionType.UPLOAD_BAN,
        RestrictionType.FULL_BAN
    ),
    uploadMedia
);

mediaRouter.post(
    '/media/:id/favorite',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(RestrictionType.FULL_BAN),
    favorite
);

mediaRouter.delete(
    '/media/:id/favorite',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(RestrictionType.FULL_BAN),
    unfavorite
);
