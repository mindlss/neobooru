import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../config/logger';
import { ApiError, isApiError } from '../errors/ApiError';
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

    // 1) Our explicit API errors
    if (isApiError(err)) {
        return sendError(res, err.status, {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId,
        });
    }

    // 2) Zod validation (query/body/params)
    if (err instanceof ZodError) {
        return sendError(res, 400, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: { issues: err.issues },
            requestId,
        });
    }

    // 3) Invalid JSON body (express.json)
    // Express throws SyntaxError with "body" attached in many cases
    if (err instanceof SyntaxError) {
        // best-effort detection of JSON parse error
        const anyErr = err as any;
        if (
            anyErr.type === 'entity.parse.failed' ||
            /JSON/i.test(err.message)
        ) {
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
        // Common mappings:
        // P2002 unique constraint failed
        // P2025 record not found
        // P2003 foreign key constraint failed
        // P2014 relation violation
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
    logger.error({ err, requestId }, 'Unhandled error');

    return sendError(res, 500, {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        requestId,
    });
}
