import express from 'express';
import pinoHttp from 'pino-http';
import 'reflect-metadata';

import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { httpLogger } from './config/logger';
import { env } from './config/env';
import { requestIdMiddleware } from './http/middlewares/requestId.middleware';
import { notFoundMiddleware } from './http/middlewares/notFound.middleware';
import { errorMiddleware } from './http/middlewares/error.middleware';

import { RegisterRoutes } from './generated/routes';
import swaggerSpec from './generated/swagger.json';

export function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.use(requestIdMiddleware);

    app.use(
        pinoHttp({
            logger: httpLogger,
            genReqId: (req) => (req as any).requestId,
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

    app.use(cookieParser());

    RegisterRoutes(app);

    if (env.NODE_ENV !== 'production') {
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    }

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}
