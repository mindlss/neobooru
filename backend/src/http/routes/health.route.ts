import { Router } from 'express';
import { env } from '../../config/env';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        env: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
    });
});
