import type { z } from 'zod';
import { apiError } from '../errors/ApiError';

type Infer<T extends z.ZodTypeAny> = z.infer<T>;

function fail(kind: 'body' | 'query' | 'params', issues: unknown) {
    const message =
        kind === 'body'
            ? 'Invalid request body'
            : kind === 'query'
            ? 'Invalid query parameters'
            : 'Invalid route parameters';

    throw apiError(400, 'VALIDATION_ERROR', message, { issues });
}

/**
 * Parse & validate request body
 */
export function parseBody<T extends z.ZodTypeAny>(
    schema: T,
    body: unknown
): Infer<T> {
    const result = schema.safeParse(body);
    if (!result.success) fail('body', result.error.issues);
    return result.data;
}

/**
 * Parse & validate request query
 */
export function parseQuery<T extends z.ZodTypeAny>(
    schema: T,
    query: unknown
): Infer<T> {
    const result = schema.safeParse(query);
    if (!result.success) fail('query', result.error.issues);
    return result.data;
}

/**
 * Parse & validate request params
 */
export function parseParams<T extends z.ZodTypeAny>(
    schema: T,
    params: unknown
): Infer<T> {
    const result = schema.safeParse(params);
    if (!result.success) fail('params', result.error.issues);
    return result.data;
}
