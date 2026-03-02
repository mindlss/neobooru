import { prisma } from '../../lib/prisma';
import { ModerationStatus, CommentDeletedKind } from '@prisma/client';

import type { PrincipalLike } from '../auth/permission.utils';
import {
    hasPermission,
    assertPermission,
    assertAnyPermission,
} from '../auth/permission.utils';
import { Permission } from '../auth/permissions';

function buildMediaVisibilityWhere(p: PrincipalLike | undefined) {
    const where: any = {};

    // deleted media
    if (!hasPermission(p, Permission.MEDIA_READ_DELETED)) {
        where.deletedAt = null;
    }

    // moderation visibility
    if (!hasPermission(p, Permission.MEDIA_READ_UNMODERATED)) {
        // only APPROVED is visible
        where.moderationStatus = ModerationStatus.APPROVED;
    }

    // explicit visibility
    if (!hasPermission(p, Permission.MEDIA_READ_EXPLICIT)) {
        where.isExplicit = false;
    }

    return where;
}

export async function listCommentsForMedia(params: {
    mediaId: string;
    principal: PrincipalLike | undefined;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
}) {
    assertPermission(params.principal, Permission.COMMENTS_READ);

    const take = Math.min(Math.max(params.limit, 1), 100);

    const media = await prisma.media.findFirst({
        where: {
            id: params.mediaId,
            ...buildMediaVisibilityWhere(params.principal),
        },
        select: { id: true },
    });
    if (!media) return { kind: 'not_found' as const };

    const orderBy =
        params.sort === 'old'
            ? { createdAt: 'asc' as const }
            : { createdAt: 'desc' as const };

    const items = await prisma.comment.findMany({
        where: { mediaId: params.mediaId },
        orderBy,
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        select: {
            id: true,
            content: true,
            mediaId: true,
            userId: true,
            parentId: true,
            createdAt: true,

            deletedAt: true,
            deletedById: true,
            deletedKind: true,
            deletedReason: true,

            user: {
                select: {
                    id: true,
                    username: true,
                    avatarKey: true,
                },
            },
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    const data = items.slice(0, take);

    return { kind: 'ok' as const, data, nextCursor };
}

export async function createComment(params: {
    mediaId: string;
    principal: PrincipalLike | undefined;
    userId: string;
    content: string;
    parentId?: string | null;
}) {
    assertPermission(params.principal, Permission.COMMENTS_CREATE);

    return prisma.$transaction(async (tx) => {
        const media = await tx.media.findFirst({
            where: {
                id: params.mediaId,
                ...buildMediaVisibilityWhere(params.principal),
            },
            select: { id: true },
        });
        if (!media) throw new Error('NOT_FOUND');

        if (params.parentId) {
            const parent = await tx.comment.findFirst({
                where: {
                    id: params.parentId,
                    mediaId: params.mediaId,
                },
                select: { id: true },
            });
            if (!parent) throw new Error('PARENT_NOT_FOUND');
        }

        const comment = await tx.comment.create({
            data: {
                mediaId: params.mediaId,
                userId: params.userId,
                content: params.content,
                parentId: params.parentId ?? null,
            },
            select: {
                id: true,
                content: true,
                mediaId: true,
                userId: true,
                parentId: true,
                createdAt: true,

                deletedAt: true,
                deletedById: true,
                deletedKind: true,
                deletedReason: true,

                user: {
                    select: {
                        id: true,
                        username: true,
                        avatarKey: true,
                    },
                },
            },
        });

        await tx.media.update({
            where: { id: params.mediaId },
            data: { commentCount: { increment: 1 } },
        });

        return comment;
    });
}

export async function softDeleteComment(params: {
    commentId: string;
    principal: PrincipalLike | undefined;
    requesterId: string;
    reason?: string;
}) {
    // delete endpoint не может быть "скрыт" через @Security(requiredPerms)
    assertAnyPermission(params.principal, [
        Permission.COMMENTS_DELETE_OWN,
        Permission.COMMENTS_DELETE_ANY,
    ]);

    return prisma.$transaction(async (tx) => {
        const comment = await tx.comment.findUnique({
            where: { id: params.commentId },
            select: {
                id: true,
                mediaId: true,
                userId: true,
                deletedAt: true,
            },
        });

        if (!comment) throw new Error('NOT_FOUND');
        if (comment.deletedAt) return { ok: true };

        const isOwner = comment.userId === params.requesterId;

        const canDeleteAny = hasPermission(
            params.principal,
            Permission.COMMENTS_DELETE_ANY,
        );

        const canDeleteOwn = hasPermission(
            params.principal,
            Permission.COMMENTS_DELETE_OWN,
        );

        if (isOwner) {
            if (!canDeleteOwn && !canDeleteAny) throw new Error('FORBIDDEN');
        } else {
            if (!canDeleteAny) throw new Error('FORBIDDEN');
        }

        const deletedKind = isOwner
            ? CommentDeletedKind.USER
            : CommentDeletedKind.MODERATOR;

        const deletedReason =
            !isOwner && canDeleteAny
                ? params.reason?.trim().slice(0, 2000) || null
                : null;

        await tx.comment.update({
            where: { id: comment.id },
            data: {
                deletedAt: new Date(),
                deletedById: params.requesterId,
                deletedKind,
                deletedReason,
            },
        });

        await tx.media.update({
            where: { id: comment.mediaId },
            data: { commentCount: { decrement: 1 } },
        });

        return { ok: true };
    });
}
