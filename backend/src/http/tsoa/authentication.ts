import type { Request } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';
import { apiError } from '../errors/ApiError';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env';

function isUserRole(v: unknown): v is UserRole {
    return (
        typeof v === 'string' && Object.values(UserRole).includes(v as UserRole)
    );
}

function readAccessTokenFromCookie(req: Request): string | null {
    const token = (req as any).cookies?.accessToken;
    if (typeof token !== 'string') return null;
    const t = token.trim();
    return t ? t : null;
}

function readBearerFallback(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    return token || null;
}

/**
 * tsoa hook: called from generated routes when you use @Security(...)
 *
 * - @Security("cookieAuth")           -> requires accessToken cookie (401 if missing/invalid)
 * - @Security("optionalCookieAuth")   -> parses cookie if present, ignores if missing/invalid
 *
 * Scopes are used for roles: @Security("cookieAuth", ["ADMIN"])
 */
export async function expressAuthentication(
    req: Request,
    securityName: string,
    scopes?: string[]
): Promise<any> {
    const token =
        readAccessTokenFromCookie(req) ??
        (env.NODE_ENV !== 'production' ? readBearerFallback(req) : null);

    if (securityName === 'optionalCookieAuth') {
        if (!token) return undefined;

        try {
            const payload = verifyAccessToken(token);

            const role = isUserRole(payload.role)
                ? payload.role
                : UserRole.UNVERIFIED;
            const principal = { id: payload.sub, role };

            if (scopes?.length) {
                const allowed = new Set(scopes);
                if (!allowed.has(principal.role)) {
                    throw apiError(403, 'FORBIDDEN', 'Insufficient role', {
                        required: scopes,
                        got: principal.role,
                    });
                }
            }

            return principal;
        } catch {
            return undefined;
        }
    }

    if (securityName === 'cookieAuth') {
        if (!token) {
            throw apiError(401, 'UNAUTHORIZED', 'Missing access token');
        }

        const payload = verifyAccessToken(token);

        const role = isUserRole(payload.role)
            ? payload.role
            : UserRole.UNVERIFIED;
        const principal = { id: payload.sub, role };

        if (scopes?.length) {
            const allowed = new Set(scopes);
            if (!allowed.has(principal.role)) {
                throw apiError(403, 'FORBIDDEN', 'Insufficient role', {
                    required: scopes,
                    got: principal.role,
                });
            }
        }

        return principal;
    }

    throw apiError(401, 'UNAUTHORIZED', 'Unknown security scheme');
}
