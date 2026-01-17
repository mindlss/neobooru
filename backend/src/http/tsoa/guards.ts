import { prisma } from '../../lib/prisma';
import { apiError } from '../errors/ApiError';
import type { UserRole, RestrictionType } from '@prisma/client';

/**
 * Throws 403 if viewer is not adult.
 * Use when endpoint is 18+ only.
 */
export function requireAdult(
    viewer: { isAdult: boolean } | undefined,
    code = 'ADULTS_ONLY'
) {
    if (!viewer?.isAdult) {
        throw apiError(403, code, 'Adults only');
    }
}

/**
 * Throws 403 if user is banned.
 */
export function requireNotBanned(
    currentUser: { isBanned: boolean } | undefined
) {
    if (!currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }
    if (currentUser.isBanned) {
        throw apiError(403, 'BANNED', 'User is banned');
    }
}

/**
 * Throws 403 if role is not in allowed list.
 */
export function requireRole(role: UserRole | undefined, allowed: UserRole[]) {
    if (!role) {
        throw apiError(401, 'UNAUTHORIZED', 'Missing auth');
    }
    if (!allowed.includes(role)) {
        throw apiError(403, 'FORBIDDEN', 'Insufficient role', {
            required: allowed,
            got: role,
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
    types: RestrictionType[]
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
