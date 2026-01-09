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

export async function setRating(input: {
    mediaId: string;
    userId: string;
    value: number; // validated in http schema
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

        return {
            mediaId: updated.id,
            ratingAvg: updated.ratingAvg,
            ratingCount: updated.ratingCount,
            myRating: null as number | null,
        };
    });
}
