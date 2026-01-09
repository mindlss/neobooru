import { Router } from 'express';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { viewerMiddleware } from '../middlewares/viewer.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType } from '@prisma/client';
import {
    createMediaComment,
    deleteCommentById,
    listComments,
} from '../controllers/comments.controller';

export const commentsRouter = Router();

// list comments for media (public with viewer context)
commentsRouter.get(
    '/media/:id/comments',
    optionalAuthMiddleware,
    viewerMiddleware,
    listComments
);

// create comment
commentsRouter.post(
    '/media/:id/comments',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(
        RestrictionType.COMMENT_BAN,
        RestrictionType.FULL_BAN
    ),
    createMediaComment
);

// soft-delete comment (owner or mod/admin)
commentsRouter.delete(
    '/comments/:id',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(
        RestrictionType.COMMENT_BAN,
        RestrictionType.FULL_BAN
    ),
    deleteCommentById
);
