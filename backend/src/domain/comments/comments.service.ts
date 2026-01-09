import { prisma } from '../../lib/prisma';
import { ModerationStatus, UserRole, CommentDeletedKind } from '@prisma/client';

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

    if (!viewer?.isAdult) base.isExplicit = false;

    return base;
}

export async function listCommentsForMedia(params: {
    mediaId: string;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort: 'new' | 'old';
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const media = await prisma.media.findFirst({
        where: { id: params.mediaId, ...buildVisibilityWhere(params.viewer) },
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
                    role: true,
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
    userId: string;
    viewer: Viewer;
    content: string;
    parentId?: string | null;
}) {
    return prisma.$transaction(async (tx) => {
        const media = await tx.media.findFirst({
            where: {
                id: params.mediaId,
                ...buildVisibilityWhere(params.viewer),
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
                        role: true,
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
    requester: { id: string; role: UserRole };
    reason?: string;
}) {
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

        const requesterIsMod =
            params.requester.role === UserRole.MODERATOR ||
            params.requester.role === UserRole.ADMIN;

        const isOwner = comment.userId === params.requester.id;

        if (!isOwner && !requesterIsMod) throw new Error('FORBIDDEN');

        const deletedKind = isOwner
            ? CommentDeletedKind.USER
            : CommentDeletedKind.MODERATOR;

        const deletedReason =
            requesterIsMod && !isOwner
                ? params.reason?.trim().slice(0, 2000) || null
                : null;

        await tx.comment.update({
            where: { id: comment.id },
            data: {
                deletedAt: new Date(),
                deletedById: params.requester.id,
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
