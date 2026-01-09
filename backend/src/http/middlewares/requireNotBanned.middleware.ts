import type { Request, Response, NextFunction } from 'express';

export function requireNotBanned(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const u = req.currentUser;

    if (!u) {
        return res.status(500).json({
            error: { code: 'INTERNAL', message: 'currentUser not loaded' },
        });
    }

    if (u.isBanned) {
        return res
            .status(403)
            .json({ error: { code: 'BANNED', message: 'User is banned' } });
    }

    next();
}
