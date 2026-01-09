import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';

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
    next();
}
