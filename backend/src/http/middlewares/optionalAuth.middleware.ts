import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';

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
        req.user = { id: payload.sub, role: payload.role as any };
    } catch {}

    next();
}
