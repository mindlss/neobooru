import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus, UserRole } from '@prisma/client';

type Viewer = { id?: string; role: UserRole; isAdult: boolean } | undefined;

function isModerator(viewer: Viewer) {
    return (
        viewer?.role === UserRole.MODERATOR || viewer?.role === UserRole.ADMIN
    );
}

function isGuest(viewer: Viewer) {
    return !viewer || viewer.role === UserRole.GUEST;
}

function buildVisibilityWhere(viewer: Viewer) {
    if (isModerator(viewer)) return {};

    if (isGuest(viewer)) {
        return {
            deletedAt: null,
            moderationStatus: ModerationStatus.APPROVED,
            isExplicit: false,
        };
    }

    const base: any = {
        deletedAt: null,
        moderationStatus: { not: ModerationStatus.REJECTED },
    };

    if (!viewer?.isAdult) {
        base.isExplicit = false;
    }

    return base;
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES
    );
}

function mapMedia(m: any) {
    const tags =
        (m.tagLinks ?? []).map((l: any) => ({
            id: l.tag.id,
            name: l.tag.name,
            usageCount: l.tag.usageCount,
            categoryId: l.tag.category.id,
            categoryName: l.tag.category.name,
            color: l.tag.customColor ?? l.tag.category.color,
            customColor: l.tag.customColor,
            addedAt: l.addedAt,
        })) ?? [];

    const favorite = Array.isArray(m.favorites) && m.favorites.length > 0;
    const myRating =
        Array.isArray(m.ratings) && m.ratings.length > 0
            ? m.ratings[0].value
            : null;

    return {
        id: m.id,
        hash: m.hash,
        type: m.type,
        contentType: m.contentType,
        size: m.size,

        width: m.width,
        height: m.height,
        duration: m.duration,

        description: m.description,
        isExplicit: m.isExplicit,

        ratingAvg: m.ratingAvg ?? 0,
        ratingCount: m.ratingCount ?? 0,
        myRating,

        originalKey: m.originalKey,
        previewKey: m.previewKey,

        moderationStatus: m.moderationStatus,
        moderatedAt: m.moderatedAt,
        moderatedById: m.moderatedById,
        moderationNotes: m.moderationNotes,

        uploadedById: m.uploadedById,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,

        deletedAt: m.deletedAt,
        deletedBy: m.deletedBy,

        tags,
        favorite,
    };
}

function buildFavoriteInclude(viewer: Viewer) {
    if (!viewer?.id) return false;

    return {
        favorites: {
            where: { userId: viewer.id },
            select: { id: true },
            take: 1,
        },
    };
}

function buildMyRatingInclude(viewer: Viewer) {
    if (!viewer?.id) return false;

    return {
        ratings: {
            where: { userId: viewer.id },
            select: { value: true },
            take: 1,
        },
    };
}

export async function getMediaByIdVisible(id: string, viewer: Viewer) {
    const where = { id, ...buildVisibilityWhere(viewer) };

    const media = await prisma.media.findFirst({
        where,
        include: {
            tagLinks: {
                include: {
                    tag: {
                        include: {
                            category: true,
                        },
                    },
                },
                orderBy: { addedAt: 'asc' },
            },
            ...(buildFavoriteInclude(viewer) as any),
            ...(buildMyRatingInclude(viewer) as any),
        },
    });

    if (!media) return null;

    const dto = mapMedia(media);

    const originalUrl = await presign(media.originalKey);
    const previewUrl = media.previewKey
        ? await presign(media.previewKey)
        : null;

    return { ...dto, originalUrl, previewUrl };
}

export async function listMediaVisible(params: {
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where: any = buildVisibilityWhere(params.viewer);

    if (params.type) where.type = params.type;

    const orderBy =
        params.sort === 'old'
            ? { createdAt: 'asc' as const }
            : { createdAt: 'desc' as const };

    const items = await prisma.media.findMany({
        where,
        orderBy,
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: {
            tagLinks: {
                include: {
                    tag: { include: { category: true } },
                },
                orderBy: { addedAt: 'asc' },
            },
            ...(buildFavoriteInclude(params.viewer) as any),
            ...(buildMyRatingInclude(params.viewer) as any),
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    const data = items.slice(0, take).map(mapMedia);

    const withUrls = await Promise.all(
        data.map(async (m) => ({
            ...m,
            previewUrl: m.previewKey ? await presign(m.previewKey) : null,
        }))
    );

    return { data: withUrls, nextCursor };
}
