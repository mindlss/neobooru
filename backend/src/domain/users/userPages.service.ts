import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus, Prisma } from '@prisma/client';
import { Permission } from '../auth/permissions';
import type { Principal } from '../auth/principal';
import { hasPermission } from '../auth/permission.utils';

type Viewer = { id?: string; isAdult: boolean } | undefined;

function isOwner(viewer: Viewer, userId: string) {
    return !!viewer?.id && viewer.id === userId;
}

/**
 * visibility policy:
 * - deleted media requires MEDIA_READ_DELETED
 * - unmoderated media requires MEDIA_READ_UNMODERATED (otherwise only APPROVED)
 * - explicit media:
 *    - if viewer.isAdult -> ok
 *    - else requires MEDIA_READ_EXPLICIT
 */
function buildVisibilityWhere(params: {
    viewer: Viewer;
    principal: Principal;
}) {
    const where: any = {};

    if (!hasPermission(params.principal, Permission.MEDIA_READ_DELETED)) {
        where.deletedAt = null;
    }

    if (!hasPermission(params.principal, Permission.MEDIA_READ_UNMODERATED)) {
        where.moderationStatus = ModerationStatus.APPROVED;
    } else {
        // staff can see pending/rejected too, no filter
    }

    const allowExplicit =
        !!params.viewer?.isAdult ||
        hasPermission(params.principal, Permission.MEDIA_READ_EXPLICIT);

    if (!allowExplicit) where.isExplicit = false;

    return where;
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
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

async function getTargetUserForSection(params: {
    userId: string;
    principal: Principal;
}) {
    const u = await prisma.user.findUnique({
        where: { id: params.userId },
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

    if (
        u.deletedAt &&
        !hasPermission(params.principal, Permission.USERS_READ_DELETED)
    ) {
        return null;
    }

    return u;
}

export async function listUserUploads(params: {
    userId: string;
    principal: Principal;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const target = await getTargetUserForSection({
        userId: params.userId,
        principal: params.principal,
    });
    if (!target) return { kind: 'not_found' as const };

    const canSeePrivate = hasPermission(
        params.principal,
        Permission.USERS_READ_PRIVATE,
    );

    if (
        !target.showUploads &&
        !canSeePrivate &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const where: any = {
        uploadedById: params.userId,
        ...buildVisibilityWhere({
            viewer: params.viewer,
            principal: params.principal,
        }),
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
        })),
    );

    return { kind: 'ok' as const, data: withUrls, nextCursor };
}

export async function listUserFavorites(params: {
    userId: string;
    principal: Principal;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const target = await getTargetUserForSection({
        userId: params.userId,
        principal: params.principal,
    });
    if (!target) return { kind: 'not_found' as const };

    const canSeePrivate = hasPermission(
        params.principal,
        Permission.USERS_READ_PRIVATE,
    );

    if (
        !target.showFavorites &&
        !canSeePrivate &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const mediaVisibility = buildVisibilityWhere({
        viewer: params.viewer,
        principal: params.principal,
    });

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
        })),
    );

    return { kind: 'ok' as const, data: withUrls, nextCursor };
}

export async function listUserComments(params: {
    userId: string;
    principal: Principal;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
}) {
    const target = await getTargetUserForSection({
        userId: params.userId,
        principal: params.principal,
    });
    if (!target) return { kind: 'not_found' as const };

    const canSeePrivate = hasPermission(
        params.principal,
        Permission.USERS_READ_PRIVATE,
    );

    if (
        !target.showComments &&
        !canSeePrivate &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const orderBy =
        params.sort === 'old'
            ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
            : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const items = await prisma.comment.findMany({
        where: {
            userId: params.userId,
            media: buildVisibilityWhere({
                viewer: params.viewer,
                principal: params.principal,
            }) as any,
        },
        orderBy: orderBy as any,
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: {
            user: { select: { id: true, username: true } },
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;

    return {
        kind: 'ok' as const,
        data: items.slice(0, take),
        nextCursor,
    };
}

export async function listUserRatings(params: {
    userId: string;
    principal: Principal;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
    type?: 'IMAGE' | 'VIDEO';
}) {
    const target = await getTargetUserForSection({
        userId: params.userId,
        principal: params.principal,
    });
    if (!target) return { kind: 'not_found' as const };

    const canSeePrivate = hasPermission(
        params.principal,
        Permission.USERS_READ_PRIVATE,
    );

    if (
        !target.showRatings &&
        !canSeePrivate &&
        !isOwner(params.viewer, params.userId)
    ) {
        return { kind: 'private' as const };
    }

    const take = Math.min(Math.max(params.limit, 1), 100);

    const mediaVisibility = buildVisibilityWhere({
        viewer: params.viewer,
        principal: params.principal,
    });

    const mediaSqlConditions: Prisma.Sql[] = [];
    if (mediaVisibility.deletedAt === null) {
        mediaSqlConditions.push(Prisma.sql`m."deletedAt" IS NULL`);
    }
    if (mediaVisibility.moderationStatus) {
        mediaSqlConditions.push(
            Prisma.sql`m."moderationStatus"::text = ${mediaVisibility.moderationStatus}`,
        );
    }
    if (mediaVisibility.isExplicit === false) {
        mediaSqlConditions.push(Prisma.sql`m."isExplicit" = false`);
    }
    if (params.type) {
        mediaSqlConditions.push(Prisma.sql`m."type"::text = ${params.type}`);
    }
    if (params.cursor) {
        mediaSqlConditions.push(
            params.sort === 'old'
                ? Prisma.sql`(r."createdAt", r."id") > (
                    SELECT "createdAt", "id" FROM "Rating" WHERE "id" = ${params.cursor}
                )`
                : Prisma.sql`(r."createdAt", r."id") < (
                    SELECT "createdAt", "id" FROM "Rating" WHERE "id" = ${params.cursor}
                )`,
        );
    }

    const visibilitySql = mediaSqlConditions.length
        ? Prisma.sql`AND ${Prisma.join(mediaSqlConditions, ' AND ')}`
        : Prisma.empty;

    const orderedIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT r."id"
        FROM "Rating" r
        INNER JOIN "Media" m ON m."id" = r."mediaId"
        WHERE r."userId" = ${params.userId}
        ${visibilitySql}
        ORDER BY r."createdAt" ${params.sort === 'old' ? Prisma.sql`ASC` : Prisma.sql`DESC`},
                 r."id" ${params.sort === 'old' ? Prisma.sql`ASC` : Prisma.sql`DESC`}
        LIMIT ${take + 1}
    `;

    const pageIds = orderedIds.slice(0, take).map((r) => r.id);
    const rows = pageIds.length
        ? await prisma.rating.findMany({
              where: { id: { in: pageIds } },
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
          })
        : [];

    const byId = new Map(rows.map((r) => [r.id, r]));
    const orderedRows = pageIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r);

    const nextCursor = orderedIds.length > take ? orderedIds[take].id : null;

    const mapped = orderedRows.map((r: any) => ({
        value: r.value,
        media: mapMedia(r.media, params.viewer),
    }));

    const withUrls = await Promise.all(
        mapped.map(async (x) => ({
            ...x,
            media: {
                ...x.media,
                previewUrl: x.media.previewKey
                    ? await presign(x.media.previewKey)
                    : null,
            },
        })),
    );

    return { kind: 'ok' as const, data: withUrls, nextCursor };
}
