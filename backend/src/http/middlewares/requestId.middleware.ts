import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length <= 100 ? incoming : randomUUID();

    (req as any).requestId = id;
    res.setHeader('x-request-id', id);

    next();
}
