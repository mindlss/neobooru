import express from 'express';
import pinoHttp from 'pino-http';

import { logger } from './config/logger';
import { apiRouter } from './http/routes';
import { requestIdMiddleware } from './http/middlewares/requestId.middleware';
import { notFoundMiddleware } from './http/middlewares/notFound.middleware';
import { errorMiddleware } from './http/middlewares/error.middleware';

export function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.use(requestIdMiddleware);

    app.use(
        pinoHttp({
            logger,
            genReqId: (req) => (req as any).requestId,
        })
    );

    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(apiRouter);

    app.use(notFoundMiddleware);

    app.use(errorMiddleware);

    return app;
}
