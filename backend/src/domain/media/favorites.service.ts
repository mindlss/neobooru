import { prisma } from '../../lib/prisma';

export async function addFavorite(input: { userId: string; mediaId: string }) {
    // upsert by compound unique
    return prisma.favorite.upsert({
        where: {
            userId_mediaId: {
                userId: input.userId,
                mediaId: input.mediaId,
            },
        },
        update: {},
        create: {
            userId: input.userId,
            mediaId: input.mediaId,
        },
        select: { id: true, userId: true, mediaId: true, createdAt: true },
    });
}

export async function removeFavorite(input: {
    userId: string;
    mediaId: string;
}) {
    // delete if exists, ignore if not
    await prisma.favorite
        .delete({
            where: {
                userId_mediaId: {
                    userId: input.userId,
                    mediaId: input.mediaId,
                },
            },
        })
        .catch(() => {});
    return { ok: true };
}
