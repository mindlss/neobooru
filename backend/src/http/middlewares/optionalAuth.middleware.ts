import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';
import { UserRole } from '@prisma/client';

function isUserRole(v: unknown): v is UserRole {
    return (
        typeof v === 'string' && Object.values(UserRole).includes(v as UserRole)
    );
}

export function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();

    const token = header.slice('Bearer '.length).trim();
    if (!token) return next();

    try {
        const payload = verifyAccessToken(token);

        const role = isUserRole(payload.role)
            ? (payload.role as UserRole)
            : UserRole.UNVERIFIED;

        req.user = { id: payload.sub, role };
    } catch {}

    next();
}
