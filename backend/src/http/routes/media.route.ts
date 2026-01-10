import { Router } from 'express';
import { listMedia, getMedia, uploadMedia } from '../controllers/media.controller';
import { favorite, unfavorite } from '../controllers/favorites.controller';
import { rateMedia, unrateMedia } from '../controllers/ratings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType, UserRole } from '@prisma/client';
import { viewerMiddleware } from '../middlewares/viewer.middleware';

export const mediaRouter = Router();

mediaRouter.get(
    '/media',
    optionalAuthMiddleware,
    viewerMiddleware,
    listMedia
);
mediaRouter.get(
    '/media/:id',
    optionalAuthMiddleware,
    viewerMiddleware,
    getMedia
);

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

// favorites
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

// ratings
mediaRouter.post(
    '/media/:id/rating',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(
        RestrictionType.RATING_BAN,
        RestrictionType.FULL_BAN
    ),
    rateMedia
);

mediaRouter.delete(
    '/media/:id/rating',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(
        RestrictionType.RATING_BAN,
        RestrictionType.FULL_BAN
    ),
    unrateMedia
);
