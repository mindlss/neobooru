import jwt from 'jsonwebtoken';

export function isJwtError(err: unknown): err is jwt.JsonWebTokenError {
    return err instanceof jwt.JsonWebTokenError;
}

export function isTokenExpiredError(
    err: unknown
): err is jwt.TokenExpiredError {
    return err instanceof jwt.TokenExpiredError;
}

export function isNotBeforeError(err: unknown): err is jwt.NotBeforeError {
    return err instanceof jwt.NotBeforeError;
}
