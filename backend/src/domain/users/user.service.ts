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

function canSeeAvatar(viewer: Viewer) {
    return !!viewer?.isAdult;
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

    if (user.deletedAt && !isModerator(params.viewer)) return null;

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

    const isAdult =
        user.birthDate != null
            ? (() => {
                  const now = new Date();
                  const eighteenYearsAgo = new Date(
                      now.getFullYear() - 18,
                      now.getMonth(),
                      now.getDate()
                  );
                  return user.birthDate <= eighteenYearsAgo;
              })()
            : false;

    const avatarUrl =
        user.avatarKey && isAdult ? await presign(user.avatarKey) : null;

    return { ...user, avatarUrl };
}

export async function patchUserSelf(params: {
    userId: string;
    input: {
        bio?: string | null;
        website?: string | null;

        showComments?: boolean;
        showRatings?: boolean;
        showFavorites?: boolean;
        showUploads?: boolean;
    };
}) {
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

    const isAdult =
        updated.birthDate != null
            ? (() => {
                  const now = new Date();
                  const eighteenYearsAgo = new Date(
                      now.getFullYear() - 18,
                      now.getMonth(),
                      now.getDate()
                  );
                  return updated.birthDate <= eighteenYearsAgo;
              })()
            : false;

    const avatarUrl =
        updated.avatarKey && isAdult ? await presign(updated.avatarKey) : null;

    return { ...updated, avatarUrl };
}
