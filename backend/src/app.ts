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

function isHealthcheckUrl(url?: string) {
    return url === '/health' || url === '/healthz';
}

function buildHttpLogObject(req: any, res: any, responseTime?: number) {
    return {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ...(typeof responseTime === 'number' ? { responseTime } : {}),
        ...(req.user?.id ? { userId: req.user.id } : {}),
        ...(req.user?.role ? { userRole: req.user.role } : {}),
        ...(req.socket?.remoteAddress
            ? { remoteAddress: req.socket.remoteAddress }
            : {}),
        ...(env.LOG_HTTP_HEADERS === 'true' ? { headers: req.headers } : {}),
    };
}

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
            customSuccessMessage: (req, res) =>
                `${req.method} ${req.url} completed with ${res.statusCode}`,
            customErrorMessage: (req, res) =>
                `${req.method} ${req.url} failed with ${res.statusCode}`,
            customSuccessObject: (req, res, val) =>
                buildHttpLogObject(req, res, val.responseTime),
            customErrorObject: (req, res, err, val) => ({
                ...buildHttpLogObject(req, res, val.responseTime),
                err,
            }),
            autoLogging: {
                ignore: (req) =>
                    env.LOG_HEALTHCHECKS === 'false' &&
                    isHealthcheckUrl(req.url),
            },
        }),
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
