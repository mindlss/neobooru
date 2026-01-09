import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus, UserRole } from '@prisma/client';

type AuthUser = { id: string; role: UserRole } | undefined;

function isModerator(user: AuthUser) {
    return user?.role === UserRole.MODERATOR || user?.role === UserRole.ADMIN;
}

function buildVisibilityWhere(user: AuthUser) {
    if (isModerator(user)) return {};

    if (user) {
        return {
            deletedAt: null,
            moderationStatus: { not: ModerationStatus.REJECTED },
        };
    }

    return {
        deletedAt: null,
        moderationStatus: ModerationStatus.APPROVED,
        isExplicit: false,
    };
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

export async function getMediaByIdVisible(id: string, user: AuthUser) {
    const where = { id, ...buildVisibilityWhere(user) };

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
    user: AuthUser;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where: any = buildVisibilityWhere(params.user);

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
