import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    issues: result.error.issues,
                },
            });
        }

        req.body = result.data;
        next();
    };
}
