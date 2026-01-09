import type { Request, Response, NextFunction } from 'express';
import type { RestrictionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export function requireNoActiveRestriction(...types: RestrictionType[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Missing auth' },
            });
        }

        const now = new Date();

        const restriction = await prisma.restriction.findFirst({
            where: {
                userId,
                isActive: true,
                type: { in: types },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { issuedAt: 'desc' },
        });

        if (!restriction) return next();

        return res.status(403).json({
            error: {
                code: 'RESTRICTED',
                message: 'Action is restricted',
                restriction: {
                    type: restriction.type,
                    reason: restriction.reason,
                    customReason: restriction.customReason,
                    expiresAt: restriction.expiresAt,
                },
            },
        });
    };
}
