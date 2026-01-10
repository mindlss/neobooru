import express from 'express';
import pinoHttp from 'pino-http';

import { httpLogger } from './config/logger';
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
            logger: httpLogger,
            genReqId: (req) => (req as any).requestId,

            // 4xx -> warn, 5xx -> error
            customLogLevel: (_req, res, err) => {
                if (err || res.statusCode >= 500) return 'error';
                if (res.statusCode >= 400) return 'warn';
                return 'info';
            },

            customProps: (req) => ({
                requestId: (req as any).requestId,
                userId: (req as any).user?.id,
                userRole: (req as any).user?.role,
                remoteAddress: req.socket?.remoteAddress,
            }),

            autoLogging: {
                ignore: (req) =>
                    req.url === '/health' || req.url === '/healthz',
            },

            serializers: {
                req(req) {
                    return {
                        method: req.method,
                        url: req.url,
                        headers: req.headers,
                    };
                },
                res(res) {
                    return {
                        statusCode: res.statusCode,
                    };
                },
            },
        })
    );

    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(apiRouter);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}
