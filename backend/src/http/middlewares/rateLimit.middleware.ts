import type { NextFunction, Request, Response } from 'express';

import { env } from '../../config/env';
import { redis } from '../../lib/redis';
import { apiError } from '../errors/ApiError';

type RateLimitOptions = {
    namespace: string;
    windowSeconds: number;
    max: number;
};

function clientKey(req: Request) {
    const principal = req.user?.id ? `user:${req.user.id}` : null;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return principal ?? `ip:${ip}`;
}

export function rateLimit(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!env.RATE_LIMIT_ENABLED) return next();

        const key = `rl:${options.namespace}:${clientKey(req)}`;

        try {
            const count = await redis.incr(key);
            if (count === 1) {
                await redis.expire(key, options.windowSeconds);
            }

            const remaining = Math.max(options.max - count, 0);
            res.setHeader('X-RateLimit-Limit', String(options.max));
            res.setHeader('X-RateLimit-Remaining', String(remaining));

            if (count > options.max) {
                const ttl = await redis.ttl(key).catch(() => options.windowSeconds);
                res.setHeader('Retry-After', String(Math.max(ttl, 1)));
                return next(
                    apiError(429, 'RATE_LIMITED', 'Too many requests', {
                        retryAfterSeconds: Math.max(ttl, 1),
                    }),
                );
            }

            return next();
        } catch (e) {
            return next(e);
        }
    };
}

export const authRateLimit = rateLimit({
    namespace: 'auth',
    windowSeconds: env.RATE_LIMIT_AUTH_WINDOW_SECONDS,
    max: env.RATE_LIMIT_AUTH_MAX,
});

export const uploadRateLimit = rateLimit({
    namespace: 'uploads',
    windowSeconds: env.RATE_LIMIT_UPLOAD_WINDOW_SECONDS,
    max: env.RATE_LIMIT_UPLOAD_MAX,
});

export const commentsRateLimit = rateLimit({
    namespace: 'comments',
    windowSeconds: env.RATE_LIMIT_COMMENTS_WINDOW_SECONDS,
    max: env.RATE_LIMIT_COMMENTS_MAX,
});
