import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { RestrictionType, UserRole } from '@prisma/client';
import { toUserSelfDTO } from '../dto';
import { getUserSelf } from '../../domain/users/user.service';
import { apiError } from '../errors/ApiError';

export const rbacRouter = Router();

rbacRouter.get(
    '/me',
    authMiddleware,
    currentUserMiddleware,
    async (req, res, next) => {
        try {
            const u = req.currentUser!;
            const full = await getUserSelf(u.id);
            if (!full) throw apiError(401, 'UNAUTHORIZED', 'User not found');
            res.json(toUserSelfDTO(full));
        } catch (e) {
            next(e);
        }
    }
);

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
