import { Router } from 'express';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { viewerMiddleware } from '../middlewares/viewer.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { getMe, getUserPublic, patchMe } from '../controllers/user.controller';

export const userRouter = Router();

// public profile
userRouter.get(
    '/users/:id',
    optionalAuthMiddleware,
    viewerMiddleware,
    getUserPublic
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
