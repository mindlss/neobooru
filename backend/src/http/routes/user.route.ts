import { Router } from 'express';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { viewerMiddleware } from '../middlewares/viewer.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { getMe, getUserPublic, patchMe } from '../controllers/user.controller';
import {
    getUserUploads,
    getUserFavorites,
    getUserComments,
    getUserRatings,
} from '../controllers/userPages.controller';

export const userRouter = Router();

// public profile
userRouter.get(
    '/users/:id',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserPublic
);

// user pages (public with viewer context + privacy flags)
userRouter.get(
    '/users/:id/uploads',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserUploads
);
userRouter.get(
    '/users/:id/favorites',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserFavorites
);
userRouter.get(
    '/users/:id/comments',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserComments
);
userRouter.get(
    '/users/:id/ratings',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserRatings
);

// self
userRouter.get('/users/me', authMiddleware, currentUserMiddleware, getMe);
userRouter.patch(
    '/users/me',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    patchMe
);
