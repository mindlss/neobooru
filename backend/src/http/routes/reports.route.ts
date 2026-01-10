import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireNoActiveRestriction } from '../middlewares/requireNoActiveRestriction.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { RestrictionType, UserRole } from '@prisma/client';
import {
    adminList,
    adminPatch,
    create,
} from '../controllers/reports.controller';

export const reportsRouter = Router();

// User: create report
reportsRouter.post(
    '/reports',
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireNoActiveRestriction(
        RestrictionType.REPORT_BAN,
        RestrictionType.FULL_BAN
    ),
    create
);

// Admin: list reports
reportsRouter.get(
    '/admin/reports',
    authMiddleware,
    currentUserMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    adminList
);

// Admin: update report status/assignment
reportsRouter.patch(
    '/admin/reports/:id',
    authMiddleware,
    currentUserMiddleware,
    requireRole(UserRole.MODERATOR, UserRole.ADMIN),
    adminPatch
);
