import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { apiError } from '../errors/ApiError';

function makeValidator(
    pick: (req: Request) => unknown,
    assign: (req: Request, v: any) => void
) {
    return (schema: ZodSchema) => {
        return (req: Request, _res: Response, next: NextFunction) => {
            const result = schema.safeParse(pick(req));

            if (!result.success) {
                return next(
                    apiError(400, 'VALIDATION_ERROR', 'Invalid request', {
                        issues: result.error.issues,
                    })
                );
            }

            assign(req, result.data);
            next();
        };
    };
}

// body
export const validate = makeValidator(
    (req) => req.body,
    (req, v) => {
        req.body = v;
    }
);

// params
export const validateParams = makeValidator(
    (req) => req.params,
    (req, v) => {
        (req as any).params = v;
    }
);

// query
export const validateQuery = makeValidator(
    (req) => req.query,
    (req, v) => {
        (req as any).query = v;
    }
);
