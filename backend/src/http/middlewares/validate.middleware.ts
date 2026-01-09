import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { apiError } from '../errors/ApiError';

export function validate(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            return next(
                apiError(400, 'VALIDATION_ERROR', 'Invalid request body', {
                    issues: result.error.issues,
                })
            );
        }

        req.body = result.data;
        next();
    };
}
