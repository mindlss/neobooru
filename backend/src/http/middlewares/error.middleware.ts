import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

export function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    const requestId = (req as any).requestId;

    logger.error({ err, requestId }, 'Unhandled error');

    res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong',
            requestId,
        },
    });
}
