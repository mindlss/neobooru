import type { Request, Response, NextFunction } from 'express';

export function notFoundMiddleware(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
            path: req.path,
        },
    });
}
