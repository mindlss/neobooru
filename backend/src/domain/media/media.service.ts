import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus } from '@prisma/client';

import { Permission } from '../auth/permissions';
import { hasPermission, type PrincipalLike } from '../auth/permission.utils';

type Principal = PrincipalLike | undefined;

function canReadDeleted(p: Principal) {
    return hasPermission(p, Permission.MEDIA_READ_DELETED);
}

function canReadUnmoderated(p: Principal) {
    return hasPermission(p, Permission.MEDIA_READ_UNMODERATED);
}

function canReadExplicit(p: Principal) {
    return hasPermission(p, Permission.MEDIA_READ_EXPLICIT);
}

function buildVisibilityWhere(p: Principal) {
    // Deleted
    const deletedFilter = canReadDeleted(p) ? {} : { deletedAt: null };

    // Moderation status
    // - guest: only APPROVED
    // - authed: not REJECTED (allows PENDING) (как было раньше)
    // - staff: any (via MEDIA_READ_UNMODERATED)
    let moderationFilter: any = {};
    if (!canReadUnmoderated(p)) {
        moderationFilter = p?.id
            ? { moderationStatus: { not: ModerationStatus.REJECTED } }
            : { moderationStatus: ModerationStatus.APPROVED };
    }

    // Explicit
    const explicitFilter = canReadExplicit(p) ? {} : { isExplicit: false };

    return { ...deletedFilter, ...moderationFilter, ...explicitFilter };
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
    );
}

function filterTagLinksForViewer(tagLinks: any[], p: Principal) {
    if (canReadExplicit(p)) return tagLinks ?? [];
    return (tagLinks ?? []).filter((l: any) => !l?.tag?.isExplicit);
}

function mapMedia(m: any, p: Principal) {
    const visibleLinks = filterTagLinksForViewer(m.tagLinks ?? [], p);

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

        commentCount: m.commentCount ?? 0,

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

function buildFavoriteInclude(p: Principal) {
    if (!p?.id) return false;

    return {
        favorites: {
            where: { userId: p.id },
            select: { id: true },
            take: 1,
        },
    };
}

function buildMyRatingInclude(p: Principal) {
    if (!p?.id) return false;

    return {
        ratings: {
            where: { userId: p.id },
            select: { value: true },
            take: 1,
        },
    };
}

export async function getMediaByIdVisible(id: string, principal: Principal) {
    const where = { id, ...buildVisibilityWhere(principal) };

    const media = await prisma.media.findFirst({
        where,
        include: {
            tagLinks: {
                include: {
                    tag: {
                        include: { category: true },
                    },
                },
                orderBy: { addedAt: 'asc' },
            },
            ...(buildFavoriteInclude(principal) as any),
            ...(buildMyRatingInclude(principal) as any),
        },
    });

    if (!media) return null;

    const dto = mapMedia(media, principal);

    const originalUrl = await presign(media.originalKey);
    const previewUrl = media.previewKey
        ? await presign(media.previewKey)
        : null;

    return { ...dto, originalUrl, previewUrl };
}

export async function listMediaVisible(params: {
    principal: Principal;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where: any = buildVisibilityWhere(params.principal);

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
            ...(buildFavoriteInclude(params.principal) as any),
            ...(buildMyRatingInclude(params.principal) as any),
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    const data = items.slice(0, take).map((m) => mapMedia(m, params.principal));

    const withUrls = await Promise.all(
        data.map(async (m) => ({
            ...m,
            previewUrl: m.previewKey ? await presign(m.previewKey) : null,
        })),
    );

    return { data: withUrls, nextCursor };
}

export type MediaBlockedReason =
    | 'NOT_FOUND'
    | 'DELETED'
    | 'REJECTED'
    | 'PENDING'
    | 'EXPLICIT';

export async function getMediaByIdOrBlocked(
    id: string,
    principal: Principal,
): Promise<
    | { kind: 'ok'; media: Awaited<ReturnType<typeof getMediaByIdVisible>> }
    | { kind: 'blocked'; reason: MediaBlockedReason }
> {
    const media = await prisma.media.findUnique({
        where: { id },
        include: {
            tagLinks: {
                include: {
                    tag: { include: { category: true } },
                },
                orderBy: { addedAt: 'asc' },
            },
            ...(buildFavoriteInclude(principal) as any),
            ...(buildMyRatingInclude(principal) as any),
        },
    });

    if (!media) return { kind: 'blocked', reason: 'NOT_FOUND' };

    // Staff/mod-like bypass via perms:
    const unmoderated = canReadUnmoderated(principal);
    const deletedOk = canReadDeleted(principal);
    const explicitOk = canReadExplicit(principal);

    if (!deletedOk && media.deletedAt)
        return { kind: 'blocked', reason: 'DELETED' };

    if (!unmoderated) {
        if (!principal?.id) {
            if (media.moderationStatus !== ModerationStatus.APPROVED) {
                return {
                    kind: 'blocked',
                    reason:
                        media.moderationStatus === ModerationStatus.PENDING
                            ? 'PENDING'
                            : 'REJECTED',
                };
            }
        } else {
            if (media.moderationStatus === ModerationStatus.REJECTED) {
                return { kind: 'blocked', reason: 'REJECTED' };
            }
        }
    }

    if (!explicitOk && media.isExplicit) {
        return { kind: 'blocked', reason: 'EXPLICIT' };
    }

    const dto = mapMedia(media, principal);
    const originalUrl = await presign(media.originalKey);
    const previewUrl = media.previewKey
        ? await presign(media.previewKey)
        : null;

    return { kind: 'ok', media: { ...dto, originalUrl, previewUrl } as any };
}
