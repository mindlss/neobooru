import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { UserRole } from '@prisma/client';

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

export async function viewerMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    // default: guest
    req.viewer = { role: UserRole.GUEST, isAdult: false };

    // if no token - keep guest viewer
    if (!req.user?.id) return next();

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

        // If token is valid but user missing/deleted - treat as guest
        if (!u || u.deletedAt) {
            req.user = undefined;
            req.viewer = { role: UserRole.GUEST, isAdult: false };
            return next();
        }

        req.viewer = {
            id: u.id,
            role: u.role,
            isAdult: computeIsAdult(u.birthDate),
        };

        return next();
    } catch {
        // On DB error - treat as guest
        req.viewer = { role: UserRole.GUEST, isAdult: false };
        return next();
    }
}
