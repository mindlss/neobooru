import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidateError } from 'tsoa';
import { logger } from '../../config/logger';
import { isApiError } from '../errors/ApiError';
import {
    isJwtError,
    isNotBeforeError,
    isTokenExpiredError,
} from '../errors/jwt';
import { isPrismaKnownError, isPrismaValidationError } from '../errors/prisma';

function getRequestId(req: Request) {
    return (req as any).requestId ?? undefined;
}

function sendError(
    res: Response,
    status: number,
    payload: {
        code: string;
        message?: string;
        details?: unknown;
        requestId?: string;
    }
) {
    return res.status(status).json({
        error: {
            code: payload.code,
            message: payload.message,
            ...(payload.details !== undefined
                ? { details: payload.details }
                : {}),
            ...(payload.requestId ? { requestId: payload.requestId } : {}),
        },
    });
}

export function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    const requestId = getRequestId(req);

    // 0) tsoa validation errors (query/path/body type coercion)
    if (err instanceof ValidateError) {
        logger.warn(
            {
                requestId,
                code: 'VALIDATION_ERROR',
                fields: err.fields,
                path: req.path,
                method: req.method,
            },
            'Invalid request (tsoa)'
        );

        return sendError(res, 400, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: { fields: err.fields },
            requestId,
        });
    }

    // 1) Explicit API errors
    if (isApiError(err)) {
        const level = err.status >= 500 ? 'error' : 'warn';
        logger[level](
            {
                requestId,
                code: err.code,
                status: err.status,
                details: err.details,
                path: req.path,
                method: req.method,
            },
            err.message || err.code
        );

        return sendError(res, err.status, {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId,
        });
    }

    // 2) Zod validation (query/body/params)
    if (err instanceof ZodError) {
        logger.warn(
            {
                requestId,
                code: 'VALIDATION_ERROR',
                issues: err.issues,
                path: req.path,
                method: req.method,
            },
            'Invalid request'
        );

        return sendError(res, 400, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: { issues: err.issues },
            requestId,
        });
    }

    // 3) Invalid JSON body (express.json)
    if (err instanceof SyntaxError) {
        const anyErr = err as any;
        if (
            anyErr.type === 'entity.parse.failed' ||
            /JSON/i.test(err.message)
        ) {
            logger.warn(
                {
                    requestId,
                    code: 'INVALID_JSON',
                    path: req.path,
                    method: req.method,
                },
                'Malformed JSON body'
            );

            return sendError(res, 400, {
                code: 'INVALID_JSON',
                message: 'Malformed JSON body',
                requestId,
            });
        }
    }

    // 4) JWT errors
    if (isTokenExpiredError(err)) {
        return sendError(res, 401, {
            code: 'TOKEN_EXPIRED',
            message: 'Access token expired',
            requestId,
        });
    }
    if (isNotBeforeError(err)) {
        return sendError(res, 401, {
            code: 'TOKEN_NOT_ACTIVE',
            message: 'Access token not active yet',
            requestId,
        });
    }
    if (isJwtError(err)) {
        return sendError(res, 401, {
            code: 'INVALID_TOKEN',
            message: 'Invalid access token',
            requestId,
        });
    }

    // 5) Prisma errors
    if (isPrismaKnownError(err)) {
        switch (err.code) {
            case 'P2002': {
                return sendError(res, 409, {
                    code: 'CONFLICT',
                    message: 'Unique constraint violation',
                    details: { target: (err.meta as any)?.target ?? null },
                    requestId,
                });
            }
            case 'P2025': {
                return sendError(res, 404, {
                    code: 'NOT_FOUND',
                    message: 'Record not found',
                    requestId,
                });
            }
            case 'P2003': {
                return sendError(res, 409, {
                    code: 'CONFLICT',
                    message: 'Foreign key constraint violation',
                    details: {
                        field_name: (err.meta as any)?.field_name ?? null,
                    },
                    requestId,
                });
            }
            default: {
                return sendError(res, 400, {
                    code: 'DB_ERROR',
                    message: 'Database request error',
                    details: { prismaCode: err.code },
                    requestId,
                });
            }
        }
    }

    if (isPrismaValidationError(err)) {
        return sendError(res, 400, {
            code: 'DB_VALIDATION_ERROR',
            message: 'Invalid database query',
            requestId,
        });
    }

    // 6) Fallback: 500
    logger.error(
        {
            err,
            requestId,
            path: req.path,
            method: req.method,
        },
        'Unhandled error'
    );

    return sendError(res, 500, {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        requestId,
    });
}
