import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { Permission } from '../auth/permissions';
import type { Principal } from '../auth/principal';
import { hasPermission } from '../auth/permission.utils';

type Viewer = { id?: string; isAdult: boolean } | undefined;

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
    );
}

function canSeeAvatar(viewer: Viewer) {
    return !!viewer?.isAdult;
}

export function computeIsAdult(birthDate: Date | null | undefined): boolean {
    if (!birthDate) return false;

    const now = new Date();
    const eighteenYearsAgo = new Date(
        now.getFullYear() - 18,
        now.getMonth(),
        now.getDate(),
    );
    return birthDate <= eighteenYearsAgo;
}

export async function getUserPublicById(params: {
    userId: string;
    principal: Principal;
    viewer: Viewer;
}) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: {
            id: true,
            username: true,
            avatarKey: true,
            bio: true,
            website: true,
            createdAt: true,
            deletedAt: true,
        },
    });

    if (!user) return null;

    if (
        user.deletedAt &&
        !hasPermission(params.principal, Permission.USERS_READ_DELETED)
    ) {
        return null;
    }

    const avatarUrl =
        user.avatarKey && canSeeAvatar(params.viewer)
            ? await presign(user.avatarKey)
            : null;

    return { ...user, avatarUrl };
}

export async function getUserSelf(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            birthDate: true,

            avatarKey: true,
            bio: true,
            website: true,

            createdAt: true,
            updatedAt: true,
            emailVerifiedAt: true,

            showComments: true,
            showRatings: true,
            showFavorites: true,
            showUploads: true,

            uploadCount: true,
            warningCount: true,
            isBanned: true,

            deletedAt: true,
        },
    });

    if (!user || user.deletedAt) return null;

    const isAdult = computeIsAdult(user.birthDate);
    const avatarUrl =
        user.avatarKey && isAdult ? await presign(user.avatarKey) : null;

    return { ...user, avatarUrl };
}

export async function patchUserSelf(params: {
    userId: string;
    principal: Principal;
    input: {
        bio?: string | null;
        website?: string | null;

        showComments?: boolean;
        showRatings?: boolean;
        showFavorites?: boolean;
        showUploads?: boolean;
    };
}) {
    if (!hasPermission(params.principal, Permission.USERS_UPDATE_SELF)) {
        throw new Error('FORBIDDEN_USERS_UPDATE_SELF');
    }

    const updated = await prisma.user.update({
        where: { id: params.userId },
        data: {
            ...(params.input.bio !== undefined
                ? { bio: params.input.bio }
                : {}),
            ...(params.input.website !== undefined
                ? { website: params.input.website }
                : {}),

            ...(params.input.showComments !== undefined
                ? { showComments: params.input.showComments }
                : {}),
            ...(params.input.showRatings !== undefined
                ? { showRatings: params.input.showRatings }
                : {}),
            ...(params.input.showFavorites !== undefined
                ? { showFavorites: params.input.showFavorites }
                : {}),
            ...(params.input.showUploads !== undefined
                ? { showUploads: params.input.showUploads }
                : {}),
        },
        select: {
            id: true,
            username: true,
            email: true,
            birthDate: true,

            avatarKey: true,
            bio: true,
            website: true,

            createdAt: true,
            updatedAt: true,
            emailVerifiedAt: true,

            showComments: true,
            showRatings: true,
            showFavorites: true,
            showUploads: true,

            uploadCount: true,
            warningCount: true,
            isBanned: true,

            deletedAt: true,
        },
    });

    const isAdult = computeIsAdult(updated.birthDate);
    const avatarUrl =
        updated.avatarKey && isAdult ? await presign(updated.avatarKey) : null;

    return { ...updated, avatarUrl };
}

export async function getUserRoleKeys(userId: string): Promise<string[]> {
    const rows = await prisma.roleAssignment.findMany({
        where: { userId },
        select: { role: { select: { key: true } } },
    });
    return rows.map((r) => r.role.key);
}
