import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentDeletedKind, ModerationStatus } from '@prisma/client';

import { Permission } from '../../../domain/auth/permissions';

const { prisma } = vi.hoisted(() => ({
    prisma: {
        media: {
            findFirst: vi.fn(),
        },
        comment: {
            findMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock('../../../lib/prisma', () => ({ prisma }));

import {
    createComment,
    listCommentsForMedia,
    softDeleteComment,
} from '../../../domain/comments/comments.service';

function createTx() {
    return {
        media: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        comment: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    };
}

describe('comments service', () => {
    const reader = {
        id: 'user-1',
        permissions: [Permission.COMMENTS_READ],
    };
    const creator = {
        id: 'user-1',
        permissions: [Permission.COMMENTS_CREATE],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(createTx()),
        );
    });

    it('requires comments.read to list comments', async () => {
        await expect(
            listCommentsForMedia({
                mediaId: 'media-1',
                principal: { id: 'user-1', permissions: [] },
                limit: 20,
                sort: 'new',
            }),
        ).rejects.toThrow('FORBIDDEN');
        expect(prisma.media.findFirst).not.toHaveBeenCalled();
    });

    it('returns not_found when visible media is missing', async () => {
        prisma.media.findFirst.mockResolvedValue(null);

        await expect(
            listCommentsForMedia({
                mediaId: 'media-1',
                principal: reader,
                limit: 20,
                sort: 'new',
            }),
        ).resolves.toEqual({ kind: 'not_found' });

        expect(prisma.media.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'media-1',
                deletedAt: null,
                moderationStatus: ModerationStatus.APPROVED,
                isExplicit: false,
            },
            select: { id: true },
        });
    });

    it('lists comments with clamped limit, cursor, and requested sort', async () => {
        const rows = [
            { id: 'c1', content: 'one' },
            { id: 'c2', content: 'two' },
            { id: 'c3', content: 'three' },
        ];
        prisma.media.findFirst.mockResolvedValue({ id: 'media-1' });
        prisma.comment.findMany.mockResolvedValue(rows);

        await expect(
            listCommentsForMedia({
                mediaId: 'media-1',
                principal: reader,
                limit: 2,
                cursor: 'cursor-1',
                sort: 'old',
            }),
        ).resolves.toEqual({
            kind: 'ok',
            data: rows.slice(0, 2),
            nextCursor: 'c3',
        });

        expect(prisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { mediaId: 'media-1' },
                orderBy: { createdAt: 'asc' },
                take: 3,
                cursor: { id: 'cursor-1' },
                skip: 1,
            }),
        );
    });

    it('creates a root comment and increments media comment count', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        const comment = { id: 'comment-1', content: 'hello' };
        tx.media.findFirst.mockResolvedValue({ id: 'media-1' });
        tx.comment.create.mockResolvedValue(comment);

        await expect(
            createComment({
                mediaId: 'media-1',
                principal: creator,
                userId: 'user-1',
                content: 'hello',
            }),
        ).resolves.toBe(comment);

        expect(tx.comment.findFirst).not.toHaveBeenCalled();
        expect(tx.comment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    mediaId: 'media-1',
                    userId: 'user-1',
                    content: 'hello',
                    parentId: null,
                },
            }),
        );
        expect(tx.media.update).toHaveBeenCalledWith({
            where: { id: 'media-1' },
            data: { commentCount: { increment: 1 } },
        });
    });

    it('rejects replies whose parent belongs to another media item', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({ id: 'media-1' });
        tx.comment.findFirst.mockResolvedValue(null);

        await expect(
            createComment({
                mediaId: 'media-1',
                principal: creator,
                userId: 'user-1',
                content: 'reply',
                parentId: 'parent-1',
            }),
        ).rejects.toThrow('PARENT_NOT_FOUND');
        expect(tx.comment.create).not.toHaveBeenCalled();
    });

    it('lets owners soft-delete their own comments without a public reason', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.comment.findUnique.mockResolvedValue({
            id: 'comment-1',
            mediaId: 'media-1',
            userId: 'user-1',
            deletedAt: null,
        });

        await expect(
            softDeleteComment({
                commentId: 'comment-1',
                principal: {
                    id: 'user-1',
                    permissions: [Permission.COMMENTS_DELETE_OWN],
                },
                requesterId: 'user-1',
                reason: 'should be ignored',
            }),
        ).resolves.toEqual({ ok: true });

        expect(tx.comment.update).toHaveBeenCalledWith({
            where: { id: 'comment-1' },
            data: {
                deletedAt: expect.any(Date),
                deletedById: 'user-1',
                deletedKind: CommentDeletedKind.USER,
                deletedReason: null,
            },
        });
        expect(tx.media.update).toHaveBeenCalledWith({
            where: { id: 'media-1' },
            data: { commentCount: { decrement: 1 } },
        });
    });

    it('lets moderators soft-delete others comments and stores trimmed reason', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.comment.findUnique.mockResolvedValue({
            id: 'comment-1',
            mediaId: 'media-1',
            userId: 'author-1',
            deletedAt: null,
        });

        await softDeleteComment({
            commentId: 'comment-1',
            principal: {
                id: 'mod-1',
                permissions: [Permission.COMMENTS_DELETE_ANY],
            },
            requesterId: 'mod-1',
            reason: '  spam  ',
        });

        expect(tx.comment.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    deletedById: 'mod-1',
                    deletedKind: CommentDeletedKind.MODERATOR,
                    deletedReason: 'spam',
                }),
            }),
        );
    });

    it('returns ok for comments that are already deleted', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.comment.findUnique.mockResolvedValue({
            id: 'comment-1',
            mediaId: 'media-1',
            userId: 'user-1',
            deletedAt: new Date(),
        });

        await expect(
            softDeleteComment({
                commentId: 'comment-1',
                principal: {
                    id: 'user-1',
                    permissions: [Permission.COMMENTS_DELETE_OWN],
                },
                requesterId: 'user-1',
            }),
        ).resolves.toEqual({ ok: true });

        expect(tx.comment.update).not.toHaveBeenCalled();
        expect(tx.media.update).not.toHaveBeenCalled();
    });

    it('rejects deleting another users comment without delete-any permission', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.comment.findUnique.mockResolvedValue({
            id: 'comment-1',
            mediaId: 'media-1',
            userId: 'author-1',
            deletedAt: null,
        });

        await expect(
            softDeleteComment({
                commentId: 'comment-1',
                principal: {
                    id: 'user-1',
                    permissions: [Permission.COMMENTS_DELETE_OWN],
                },
                requesterId: 'user-1',
            }),
        ).rejects.toThrow('FORBIDDEN');

        expect(tx.comment.update).not.toHaveBeenCalled();
    });
});
