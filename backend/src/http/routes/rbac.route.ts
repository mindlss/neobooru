import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType, UserRole } from '@prisma/client';

export const rbacRouter = Router();

rbacRouter.get('/me', authMiddleware, currentUserMiddleware, (req, res) => {
    const u = req.currentUser!;
    res.json({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isBanned: u.isBanned,
        createdAt: u.createdAt,
    });
});

rbacRouter.get(
    '/admin/ping',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    (_req, res) => res.json({ status: 'ok' })
);

rbacRouter.get(
    '/upload/ping',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(UserRole.TRUSTED, UserRole.MODERATOR, UserRole.ADMIN),
    requireNoActiveRestriction(
        RestrictionType.UPLOAD_BAN,
        RestrictionType.FULL_BAN
    ),
    (_req, res) => res.json({ status: 'ok' })
);
