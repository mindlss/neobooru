export type ApiErrorPayload = {
    code: string;
    message?: string;
    details?: unknown;
};

export class ApiError extends Error {
    public readonly status: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(
        status: number,
        code: string,
        message?: string,
        details?: unknown
    ) {
        super(message ?? code);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export function apiError(
    status: number,
    code: string,
    message?: string,
    details?: unknown
) {
    return new ApiError(status, code, message, details);
}

export function isApiError(err: unknown): err is ApiError {
    return (
        typeof err === 'object' &&
        err !== null &&
        (err as any).name === 'ApiError' &&
        typeof (err as any).status === 'number' &&
        typeof (err as any).code === 'string'
    );
}
