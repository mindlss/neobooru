import { Router } from 'express';
import { uploadMedia } from '../controllers/media.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType, UserRole } from '@prisma/client';

export const mediaRouter = Router();

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
