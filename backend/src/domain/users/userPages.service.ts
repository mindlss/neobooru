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

function isOwner(viewer: Viewer, userId: string) {
    return !!viewer?.id && viewer.id === userId;
}

function buildVisibilityWhere(viewer: Viewer) {
    if (isModerator(viewer)) return {};

    if (!viewer || viewer.role === UserRole.GUEST) {
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

    if (!viewer.isAdult) base.isExplicit = false;

    return base;
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES
    );
}

function filterTagLinksForViewer(tagLinks: any[], viewer: Viewer) {
    if (viewer?.isAdult) return tagLinks ?? [];
    return (tagLinks ?? []).filter((l: any) => !l?.tag?.isExplicit);
}

function mapMedia(m: any, viewer: Viewer) {
    const visibleLinks = filterTagLinksForViewer(m.tagLinks ?? [], viewer);

    const tags =
        (visibleLinks ?? []).map((l: any) => ({
            id: l.tag.id,
            name: l.tag.name,
            usageCount: l.tag.usageCount,
            categoryId: l.tag.category.id,
            categoryName: l.tag.category.name,
            color: l.tag.customColor ?? l.tag.category.color,
            customColor: l.tag.customColor,
            addedAt: l.addedAt,
        })) ?? [];

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
    };
}

async function getTargetUserForSection(userId: string, viewer: Viewer) {
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            deletedAt: true,
            showUploads: true,
            showFavorites: true,
            showComments: true,
            showRatings: true,
        },
    });

    if (!u) return null;
    if (u.deletedAt && !isModerator(viewer)) return null;

    return u;
}

export async function listUserUploads(params: {
    userId: string;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const target = await getTargetUserForSection(params.userId, params.viewer);
    if (!target) return { kind: 'not_found' as const };

    if (
        !target.showUploads &&
        !isModerator(params.viewer) &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const where: any = {
        uploadedById: params.userId,
        ...buildVisibilityWhere(params.viewer),
    };
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
                include: { tag: { include: { category: true } } },
                orderBy: { addedAt: 'asc' },
            },
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    const data = items.slice(0, take).map((m) => mapMedia(m, params.viewer));

    const withUrls = await Promise.all(
        data.map(async (m) => ({
            ...m,
            previewUrl: m.previewKey ? await presign(m.previewKey) : null,
        }))
    );

    return { kind: 'ok' as const, data: withUrls, nextCursor };
}

export async function listUserFavorites(params: {
    userId: string;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const target = await getTargetUserForSection(params.userId, params.viewer);
    if (!target) return { kind: 'not_found' as const };

    if (
        !target.showFavorites &&
        !isModerator(params.viewer) &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const mediaVisibility = buildVisibilityWhere(params.viewer);

    const orderBy =
        params.sort === 'old'
            ? { createdAt: 'asc' as const }
            : { createdAt: 'desc' as const };

    const favorites = await prisma.favorite.findMany({
        where: {
            userId: params.userId,
            media: {
                ...mediaVisibility,
                ...(params.type ? { type: params.type } : {}),
            },
        },
        orderBy,
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: {
            media: {
                include: {
                    tagLinks: {
                        include: { tag: { include: { category: true } } },
                        orderBy: { addedAt: 'asc' },
                    },
                },
            },
        },
    });

    const nextCursor = favorites.length > take ? favorites[take].id : null;
    const mediaRows = favorites
        .slice(0, take)
        .map((f) => mapMedia(f.media, params.viewer));

    const withUrls = await Promise.all(
        mediaRows.map(async (m) => ({
            ...m,
            previewUrl: m.previewKey ? await presign(m.previewKey) : null,
        }))
    );

    return { kind: 'ok' as const, data: withUrls, nextCursor };
}
