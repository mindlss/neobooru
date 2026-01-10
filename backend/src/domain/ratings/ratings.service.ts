import { prisma } from '../../lib/prisma';
import { ModerationStatus, UserRole } from '@prisma/client';

type Viewer = { id: string; role: UserRole; isAdult: boolean };

function isModerator(viewer: Viewer) {
    return viewer.role === UserRole.MODERATOR || viewer.role === UserRole.ADMIN;
}

function buildRateableWhere(mediaId: string, viewer: Viewer) {
    if (isModerator(viewer)) return { id: mediaId };

    const where: any = {
        id: mediaId,
        deletedAt: null,
        moderationStatus: { not: ModerationStatus.REJECTED },
    };

    if (!viewer.isAdult) where.isExplicit = false;

    return where;
}

function computeAvg(sum: number, count: number) {
    if (count <= 0) return 0;
    return sum / count;
}

async function applyRatingDeltaToComics(
    tx: any,
    mediaId: string,
    deltaSum: number,
    deltaCount: number
) {
    if (deltaSum === 0 && deltaCount === 0) return;

    const links = await tx.comicPage.findMany({
        where: { mediaId },
        select: { comicId: true },
        distinct: ['comicId'],
    });

    if (links.length === 0) return;

    for (const l of links) {
        const c = await tx.comic.findUnique({
            where: { id: l.comicId },
            select: { ratingSum: true, ratingCount: true },
        });
        if (!c) continue;

        const newSum = c.ratingSum + deltaSum;
        const newCount = Math.max(0, c.ratingCount + deltaCount);
        const newAvg = computeAvg(newSum, newCount);

        await tx.comic.update({
            where: { id: l.comicId },
            data: {
                ratingSum: newSum,
                ratingCount: newCount,
                ratingAvg: newAvg,
            },
        });
    }
}

export async function setRating(input: {
    mediaId: string;
    userId: string;
    value: number;
    viewer: Viewer;
}) {
    return prisma.$transaction(async (tx) => {
        const media = await tx.media.findFirst({
            where: buildRateableWhere(input.mediaId, input.viewer),
            select: {
                id: true,
                ratingSum: true,
                ratingCount: true,
            },
        });

        if (!media) throw new Error('NOT_FOUND');

        const existing = await tx.rating.findUnique({
            where: {
                mediaId_userId: {
                    mediaId: input.mediaId,
                    userId: input.userId,
                },
            },
            select: { id: true, value: true },
        });

        let newSum = media.ratingSum;
        let newCount = media.ratingCount;

        if (!existing) {
            await tx.rating.create({
                data: {
                    mediaId: input.mediaId,
                    userId: input.userId,
                    value: input.value,
                },
            });

            newSum += input.value;
            newCount += 1;
        } else {
            if (existing.value !== input.value) {
                await tx.rating.update({
                    where: { id: existing.id },
                    data: { value: input.value },
                });

                newSum += input.value - existing.value;
            }
            // count unchanged
        }

        const ratingAvg = computeAvg(newSum, newCount);

        const updated = await tx.media.update({
            where: { id: input.mediaId },
            data: {
                ratingSum: newSum,
                ratingCount: newCount,
                ratingAvg,
            },
            select: {
                id: true,
                ratingSum: true,
                ratingCount: true,
                ratingAvg: true,
            },
        });

        const deltaSum = newSum - media.ratingSum;
        const deltaCount = newCount - media.ratingCount;
        await applyRatingDeltaToComics(tx, input.mediaId, deltaSum, deltaCount);

        return {
            mediaId: updated.id,
            ratingAvg: updated.ratingAvg,
            ratingCount: updated.ratingCount,
            myRating: input.value,
        };
    });
}

export async function removeRating(input: {
    mediaId: string;
    userId: string;
    viewer: Viewer;
}) {
    return prisma.$transaction(async (tx) => {
        const media = await tx.media.findFirst({
            where: buildRateableWhere(input.mediaId, input.viewer),
            select: {
                id: true,
                ratingSum: true,
                ratingCount: true,
            },
        });

        if (!media) throw new Error('NOT_FOUND');

        const existing = await tx.rating.findUnique({
            where: {
                mediaId_userId: {
                    mediaId: input.mediaId,
                    userId: input.userId,
                },
            },
            select: { id: true, value: true },
        });

        if (!existing) {
            // idempotent
            return {
                mediaId: media.id,
                ratingAvg: computeAvg(media.ratingSum, media.ratingCount),
                ratingCount: media.ratingCount,
                myRating: null as number | null,
            };
        }

        await tx.rating.delete({ where: { id: existing.id } });

        const newSum = media.ratingSum - existing.value;
        const newCount = Math.max(0, media.ratingCount - 1);
        const ratingAvg = computeAvg(newSum, newCount);

        const updated = await tx.media.update({
            where: { id: input.mediaId },
            data: {
                ratingSum: newSum,
                ratingCount: newCount,
                ratingAvg,
            },
            select: {
                id: true,
                ratingCount: true,
                ratingAvg: true,
            },
        });

        const deltaSum = newSum - media.ratingSum;
        const deltaCount = newCount - media.ratingCount;
        await applyRatingDeltaToComics(tx, input.mediaId, deltaSum, deltaCount);

        return {
            mediaId: updated.id,
            ratingAvg: updated.ratingAvg,
            ratingCount: updated.ratingCount,
            myRating: null as number | null,
        };
    });
}
