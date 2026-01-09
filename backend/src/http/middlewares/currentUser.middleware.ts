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

export async function currentUserMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (!req.user?.id) {
        return res
            .status(401)
            .json({ error: { code: 'UNAUTHORIZED', message: 'Missing auth' } });
    }

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
    });

    if (!user || user.deletedAt) {
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'User not found' },
        });
    }

    req.currentUser = user;

    req.viewer = {
        id: user.id,
        role: user.role,
        isAdult: computeIsAdult(user.birthDate),
    };

    next();
}
