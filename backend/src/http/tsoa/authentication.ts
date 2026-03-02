import type { Request } from 'express';
import { verifyAccessToken } from '../../domain/auth/token.service';
import { apiError } from '../errors/ApiError';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { Scope } from '../../domain/auth/permissions';

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

async function loadUserMinimal(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, deletedAt: true },
    });
}

async function loadUserPermissions(userId: string): Promise<string[]> {
    const rows = await prisma.permission.findMany({
        where: {
            roles: {
                some: {
                    role: { assignments: { some: { userId } } },
                },
            },
        },
        select: { key: true },
    });

    return Array.from(new Set(rows.map((r) => r.key)));
}

function hasAll(perms: string[], required: string[]) {
    const set = new Set(perms);
    return required.every((p) => set.has(p));
}

export type Principal = { id: string; permissions?: string[] };

function splitScopes(scopes?: string[]) {
    const requiredPerms: string[] = [];
    let forceLoad = false;

    for (const s of scopes ?? []) {
        if (s === Scope.LOAD_PERMISSIONS) forceLoad = true;
        else requiredPerms.push(s);
    }

    return { requiredPerms, forceLoad };
}

/**
 * - cookieAuth: token required, missing/deleted user => 401
 * - optionalCookieAuth: token optional, missing/deleted user => undefined (guest)
 *
 * scopes:
 * - permission keys (checked)
 * - plus optional service scope: "auth.load_permissions" (forces loading permissions into principal)
 */
export async function expressAuthentication(
    req: Request,
    securityName: string,
    scopes?: string[],
): Promise<Principal | undefined> {
    const token =
        readAccessTokenFromCookie(req) ??
        (env.NODE_ENV !== 'production' ? readBearerFallback(req) : null);

    const { requiredPerms, forceLoad } = splitScopes(scopes);
    const needPerms = forceLoad || requiredPerms.length > 0;

    if (securityName === 'optionalCookieAuth') {
        if (!token) return undefined;

        try {
            const payload = await verifyAccessToken(token);

            const u = await loadUserMinimal(payload.sub);
            if (!u || u.deletedAt) return undefined;

            const principal: Principal = { id: u.id };

            if (needPerms) {
                const permissions = await loadUserPermissions(u.id);

                if (
                    requiredPerms.length &&
                    !hasAll(permissions, requiredPerms)
                ) {
                    throw apiError(403, 'FORBIDDEN', 'Missing permissions', {
                        required: requiredPerms,
                    });
                }

                principal.permissions = permissions;
            }

            return principal;
        } catch (e) {
            if ((e as any)?.status === 403) throw e;
            return undefined;
        }
    }

    if (securityName === 'cookieAuth') {
        if (!token) throw apiError(401, 'UNAUTHORIZED', 'Missing access token');

        const payload = await verifyAccessToken(token);

        const u = await loadUserMinimal(payload.sub);
        if (!u || u.deletedAt) {
            throw apiError(401, 'UNAUTHORIZED', 'User not found');
        }

        const principal: Principal = { id: u.id };

        if (needPerms) {
            const permissions = await loadUserPermissions(u.id);

            if (requiredPerms.length && !hasAll(permissions, requiredPerms)) {
                throw apiError(403, 'FORBIDDEN', 'Missing permissions', {
                    required: requiredPerms,
                });
            }

            principal.permissions = permissions;
        }

        return principal;
    }

    throw apiError(401, 'UNAUTHORIZED', 'Unknown security scheme');
}
