import { RestrictionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { apiError } from '../errors/ApiError';

/**
 * Throws 403 if viewer is not adult.
 */
export function requireAdult(
    viewer: { isAdult: boolean } | undefined,
    code = 'ADULTS_ONLY',
) {
    if (!viewer?.isAdult) {
        throw apiError(403, code, 'Adults only');
    }
}

/**
 * Throws 403 if user is banned.
 */
export function requireNotBanned(
    currentUser: { isBanned: boolean } | undefined,
) {
    if (!currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }
    if (currentUser.isBanned) {
        throw apiError(403, 'BANNED', 'User is banned');
    }
}

function hasAll(perms: string[], required: string[]) {
    const set = new Set(perms);
    return required.every((p) => set.has(p));
}

/**
 * Throws 403 if user is missing required permissions.
 *
 * Optimization:
 * - if principal.permissions already loaded -> check in-memory
 * - else -> query DB
 */
export async function requirePermissions(
    principal: { id: string; permissions?: string[] } | undefined,
    required: string[],
) {
    if (!principal) {
        throw apiError(401, 'UNAUTHORIZED', 'Missing auth');
    }
    if (!required.length) return;

    const uniqRequired = Array.from(new Set(required));

    if (Array.isArray(principal.permissions)) {
        if (!hasAll(principal.permissions, uniqRequired)) {
            throw apiError(403, 'FORBIDDEN', 'Missing permissions', {
                required: uniqRequired,
            });
        }
        return;
    }

    const rows = await prisma.permission.findMany({
        where: {
            key: { in: uniqRequired },
            roles: {
                some: {
                    role: {
                        assignments: {
                            some: { userId: principal.id },
                        },
                    },
                },
            },
        },
        select: { key: true },
    });

    if (rows.length !== uniqRequired.length) {
        throw apiError(403, 'FORBIDDEN', 'Missing permissions', {
            required: uniqRequired,
            got: rows.map((r) => r.key),
        });
    }
}

/**
 * Same behavior as requireNoActiveRestriction.middleware.ts:
 * - if restriction exists and expired -> auto-deactivate and allow
 * - if active -> 403 RESTRICTED
 */
export async function requireNoActiveRestriction(
    userId: string | undefined,
    types: RestrictionType[],
) {
    if (!userId) {
        throw apiError(401, 'UNAUTHORIZED', 'Missing auth');
    }

    const now = new Date();

    const restriction = await prisma.restriction.findFirst({
        where: {
            userId,
            isActive: true,
            type: { in: types },
        },
        orderBy: { issuedAt: 'desc' },
    });

    if (!restriction) return;

    if (restriction.expiresAt && restriction.expiresAt <= now) {
        await prisma.restriction.update({
            where: { id: restriction.id },
            data: {
                isActive: false,
                revokedAt: now,
            },
        });
        return;
    }

    throw apiError(403, 'RESTRICTED', 'Action is restricted', {
        restriction: {
            type: restriction.type,
            reason: restriction.reason,
            customReason: restriction.customReason,
            expiresAt: restriction.expiresAt,
        },
    });
}
