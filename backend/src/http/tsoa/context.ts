import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { UserRole } from '@prisma/client';
import { apiError } from '../errors/ApiError';

function computeIsAdult(birthDate: Date | null | undefined): boolean {
    if (!birthDate) return false;

    const now = new Date();
    const eighteenYearsAgo = new Date(
        now.getFullYear() - 18,
        now.getMonth(),
        now.getDate()
    );

    return birthDate <= eighteenYearsAgo;
}

/**
 * Ensures req.viewer is always present.
 * - Default: guest
 * - If req.user?.id is set (from tsoa authentication), tries to load minimal user fields
 * - On any error or missing/deleted user -> guest
 *
 * This is a drop-in replacement for viewerMiddleware, but as a function call.
 */
export async function ensureViewer(req: Request): Promise<void> {
    req.viewer = { role: UserRole.GUEST, isAdult: false };

    if (!req.user?.id) return;

    try {
        const u = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                role: true,
                birthDate: true,
                deletedAt: true,
            },
        });

        if (!u || u.deletedAt) {
            req.user = undefined;
            req.viewer = { role: UserRole.GUEST, isAdult: false };
            return;
        }

        req.viewer = {
            id: u.id,
            role: u.role,
            isAdult: computeIsAdult(u.birthDate),
        };
    } catch {
        req.viewer = { role: UserRole.GUEST, isAdult: false };
    }
}

/**
 * Loads full current user and also sets req.viewer.
 * Throws ApiError(401) if auth missing or user not found/deleted.
 *
 * This replaces currentUserMiddleware but without Express res/next usage.
 */
export async function requireCurrentUser(req: Request) {
    if (!req.user?.id) {
        throw apiError(401, 'UNAUTHORIZED', 'Missing auth');
    }

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
    });

    if (!user || user.deletedAt) {
        throw apiError(401, 'UNAUTHORIZED', 'User not found');
    }

    req.currentUser = user;

    req.viewer = {
        id: user.id,
        role: user.role,
        isAdult: computeIsAdult(user.birthDate),
    };

    return { user, viewer: req.viewer };
}
