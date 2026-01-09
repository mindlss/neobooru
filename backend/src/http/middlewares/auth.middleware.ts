import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';

export function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
        const token = header.slice(7);
        const payload = verifyAccessToken(token);

        req.user = {
            id: payload.sub,
            role: payload.role,
        };

        next();
    } catch {
        res.status(401).json({ error: 'INVALID_TOKEN' });
    }
}
