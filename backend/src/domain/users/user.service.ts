import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { UserRole } from '@prisma/client';

type Viewer = { id?: string; role: UserRole; isAdult: boolean } | undefined;

function isModerator(viewer: Viewer) {
    return (
        viewer?.role === UserRole.MODERATOR || viewer?.role === UserRole.ADMIN
    );
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES
    );
}

export async function getUserPublicById(params: {
    userId: string;
    viewer: Viewer;
}) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: {
            id: true,
            username: true,
            role: true,
            avatarKey: true,
            bio: true,
            website: true,
            createdAt: true,
            deletedAt: true,
        },
    });

    if (!user) return null;

    // Only moderators/admins can see deleted users
    if (user.deletedAt && !isModerator(params.viewer)) return null;

    const avatarUrl = user.avatarKey ? await presign(user.avatarKey) : null;

    return { ...user, avatarUrl };
}

export async function getUserSelf(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
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

    const avatarUrl = user.avatarKey ? await presign(user.avatarKey) : null;

    return { ...user, avatarUrl };
}

export async function patchUserSelf(params: {
    userId: string;
    input: {
        avatarKey?: string | null;
        bio?: string | null;
        website?: string | null;
        birthDate?: Date | null;

        showComments?: boolean;
        showRatings?: boolean;
        showFavorites?: boolean;
        showUploads?: boolean;
    };
}) {
    const updated = await prisma.user.update({
        where: { id: params.userId },
        data: {
            ...(params.input.avatarKey !== undefined
                ? { avatarKey: params.input.avatarKey }
                : {}),
            ...(params.input.bio !== undefined
                ? { bio: params.input.bio }
                : {}),
            ...(params.input.website !== undefined
                ? { website: params.input.website }
                : {}),
            ...(params.input.birthDate !== undefined
                ? { birthDate: params.input.birthDate }
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
            role: true,
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

    const avatarUrl = updated.avatarKey
        ? await presign(updated.avatarKey)
        : null;

    return { ...updated, avatarUrl };
}
