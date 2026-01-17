export type ErrorEnvelopeDTO = {
    error: {
        code: string;
        message?: string;
        details?: unknown;
        requestId?: string;
    };
};
