import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';
import { apiError } from '../errors/ApiError';

export async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return next(apiError(401, 'UNAUTHORIZED', 'Missing Bearer token'));
    }

    const token = header.slice(7).trim();
    if (!token) {
        return next(apiError(401, 'UNAUTHORIZED', 'Missing Bearer token'));
    }

    try {
        const payload = await verifyAccessToken(token);

        req.user = { id: payload.sub };

        next();
    } catch (e) {
        next(e);
    }
}
