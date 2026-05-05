import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationStatus } from '@prisma/client';

import { Permission } from '../../../domain/auth/permissions';

const { prisma } = vi.hoisted(() => ({
    prisma: {
        $transaction: vi.fn(),
    },
}));

vi.mock('../../../lib/prisma', () => ({ prisma }));

import { removeRating, setRating } from '../../../domain/ratings/ratings.service';

function createTx() {
    return {
        media: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        rating: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        comicPage: {
            findMany: vi.fn(),
        },
        comic: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    };
}

describe('ratings service', () => {
    const principal = {
        id: 'user-1',
        permissions: [Permission.RATINGS_SET, Permission.RATINGS_REMOVE],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(createTx()),
        );
    });

    it('requires permission to set ratings', async () => {
        await expect(
            setRating({
                mediaId: 'media-1',
                userId: 'user-1',
                value: 5,
                principal: { id: 'user-1', permissions: [] },
            }),
        ).rejects.toThrow('FORBIDDEN');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a first rating and updates media aggregate fields', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({
            id: 'media-1',
            ratingSum: 10,
            ratingCount: 2,
        });
        tx.rating.findUnique.mockResolvedValue(null);
        tx.media.update.mockResolvedValue({
            id: 'media-1',
            ratingSum: 15,
            ratingCount: 3,
            ratingAvg: 5,
        });
        tx.comicPage.findMany.mockResolvedValue([]);

        await expect(
            setRating({
                mediaId: 'media-1',
                userId: 'user-1',
                value: 5,
                principal,
            }),
        ).resolves.toEqual({
            mediaId: 'media-1',
            ratingAvg: 5,
            ratingCount: 3,
            myRating: 5,
        });

        expect(tx.media.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'media-1',
                deletedAt: null,
                moderationStatus: ModerationStatus.APPROVED,
                isExplicit: false,
            },
            select: { id: true, ratingSum: true, ratingCount: true },
        });
        expect(tx.rating.create).toHaveBeenCalledWith({
            data: {
                mediaId: 'media-1',
                userId: 'user-1',
                value: 5,
            },
        });
        expect(tx.media.update).toHaveBeenCalledWith({
            where: { id: 'media-1' },
            data: {
                ratingSum: 15,
                ratingCount: 3,
                ratingAvg: 5,
            },
            select: {
                id: true,
                ratingSum: true,
                ratingCount: true,
                ratingAvg: true,
            },
        });
    });

    it('updates an existing rating without changing rating count', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({
            id: 'media-1',
            ratingSum: 8,
            ratingCount: 2,
        });
        tx.rating.findUnique.mockResolvedValue({ id: 'rating-1', value: 2 });
        tx.media.update.mockResolvedValue({
            id: 'media-1',
            ratingSum: 11,
            ratingCount: 2,
            ratingAvg: 5.5,
        });
        tx.comicPage.findMany.mockResolvedValue([]);

        await setRating({
            mediaId: 'media-1',
            userId: 'user-1',
            value: 5,
            principal,
        });

        expect(tx.rating.update).toHaveBeenCalledWith({
            where: { id: 'rating-1' },
            data: { value: 5 },
        });
        expect(tx.media.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    ratingSum: 11,
                    ratingCount: 2,
                    ratingAvg: 5.5,
                }),
            }),
        );
    });

    it('propagates rating deltas to linked comics', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({
            id: 'media-1',
            ratingSum: 10,
            ratingCount: 2,
        });
        tx.rating.findUnique.mockResolvedValue(null);
        tx.media.update.mockResolvedValue({
            id: 'media-1',
            ratingSum: 14,
            ratingCount: 3,
            ratingAvg: 14 / 3,
        });
        tx.comicPage.findMany.mockResolvedValue([{ comicId: 'comic-1' }]);
        tx.comic.findUnique.mockResolvedValue({
            ratingSum: 6,
            ratingCount: 2,
        });

        await setRating({
            mediaId: 'media-1',
            userId: 'user-1',
            value: 4,
            principal,
        });

        expect(tx.comic.update).toHaveBeenCalledWith({
            where: { id: 'comic-1' },
            data: {
                ratingSum: 10,
                ratingCount: 3,
                ratingAvg: 10 / 3,
            },
        });
    });

    it('returns unchanged aggregate when removing a missing rating', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({
            id: 'media-1',
            ratingSum: 9,
            ratingCount: 3,
        });
        tx.rating.findUnique.mockResolvedValue(null);

        await expect(
            removeRating({
                mediaId: 'media-1',
                userId: 'user-1',
                principal,
            }),
        ).resolves.toEqual({
            mediaId: 'media-1',
            ratingAvg: 3,
            ratingCount: 3,
            myRating: null,
        });

        expect(tx.rating.delete).not.toHaveBeenCalled();
        expect(tx.media.update).not.toHaveBeenCalled();
    });

    it('deletes an existing rating and clamps count at zero', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
            cb(tx),
        );
        tx.media.findFirst.mockResolvedValue({
            id: 'media-1',
            ratingSum: 5,
            ratingCount: 1,
        });
        tx.rating.findUnique.mockResolvedValue({ id: 'rating-1', value: 5 });
        tx.media.update.mockResolvedValue({
            id: 'media-1',
            ratingCount: 0,
            ratingAvg: 0,
        });
        tx.comicPage.findMany.mockResolvedValue([]);

        await expect(
            removeRating({
                mediaId: 'media-1',
                userId: 'user-1',
                principal,
            }),
        ).resolves.toEqual({
            mediaId: 'media-1',
            ratingAvg: 0,
            ratingCount: 0,
            myRating: null,
        });

        expect(tx.rating.delete).toHaveBeenCalledWith({
            where: { id: 'rating-1' },
        });
        expect(tx.media.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    ratingSum: 0,
                    ratingCount: 0,
                    ratingAvg: 0,
                },
            }),
        );
    });
});
