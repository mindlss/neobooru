import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
    prisma: {
        favorite: {
            upsert: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

vi.mock('../../../lib/prisma', () => ({ prisma }));

import {
    addFavorite,
    removeFavorite,
} from '../../../domain/media/favorites.service';

describe('favorites service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('upserts a favorite by compound user/media key', async () => {
        const favorite = {
            id: 'fav-1',
            userId: 'user-1',
            mediaId: 'media-1',
            createdAt: new Date(),
        };
        prisma.favorite.upsert.mockResolvedValue(favorite);

        await expect(
            addFavorite({ userId: 'user-1', mediaId: 'media-1' }),
        ).resolves.toBe(favorite);

        expect(prisma.favorite.upsert).toHaveBeenCalledWith({
            where: {
                userId_mediaId: {
                    userId: 'user-1',
                    mediaId: 'media-1',
                },
            },
            update: {},
            create: {
                userId: 'user-1',
                mediaId: 'media-1',
            },
            select: { id: true, userId: true, mediaId: true, createdAt: true },
        });
    });

    it('deletes existing favorites and returns ok', async () => {
        prisma.favorite.delete.mockResolvedValue({});

        await expect(
            removeFavorite({ userId: 'user-1', mediaId: 'media-1' }),
        ).resolves.toEqual({ ok: true });

        expect(prisma.favorite.delete).toHaveBeenCalledWith({
            where: {
                userId_mediaId: {
                    userId: 'user-1',
                    mediaId: 'media-1',
                },
            },
        });
    });

    it('ignores missing favorites on delete', async () => {
        prisma.favorite.delete.mockRejectedValue(new Error('missing'));

        await expect(
            removeFavorite({ userId: 'user-1', mediaId: 'media-1' }),
        ).resolves.toEqual({ ok: true });
    });
});
