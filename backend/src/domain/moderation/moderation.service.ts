import { prisma } from '../../lib/prisma';
import { ModerationStatus } from '@prisma/client';
import { writeModerationLog } from './audit';

export async function listPendingMedia(params: {
    limit: number;
    cursor?: string;
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const items = await prisma.media.findMany({
        where: {
            moderationStatus: ModerationStatus.PENDING,
            deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        select: {
            id: true,
            hash: true,
            type: true,
            contentType: true,
            size: true,
            originalKey: true,
            previewKey: true,
            uploadedById: true,
            createdAt: true,
            moderationStatus: true,
            isExplicit: true,
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    const data = items.slice(0, take);

    return { data, nextCursor };
}

export async function approveMedia(input: {
    mediaId: string;
    moderatorId: string;
    notes?: string;
    requestId?: string;
}) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
        const before = await tx.media.findUnique({
            where: { id: input.mediaId },
            select: { moderationStatus: true },
        });

        if (!before) throw new Error('NOT_FOUND');

        const updated = await tx.media.update({
            where: { id: input.mediaId },
            data: {
                moderationStatus: ModerationStatus.APPROVED,
                moderatedAt: now,
                moderatedById: input.moderatorId,
                moderationNotes: input.notes ?? null,
            },
            select: { id: true, moderationStatus: true },
        });

        await writeModerationLog({
            action: 'MEDIA_APPROVE',
            targetType: 'media',
            targetId: updated.id,
            moderatorId: input.moderatorId,
            details: {
                from: before.moderationStatus,
                to: updated.moderationStatus,
                notes: input.notes ?? null,
                requestId: input.requestId,
            },
        });

        return updated;
    });
}

export async function rejectMedia(input: {
    mediaId: string;
    moderatorId: string;
    notes?: string;
    requestId?: string;
}) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
        const before = await tx.media.findUnique({
            where: { id: input.mediaId },
            select: { moderationStatus: true },
        });

        if (!before) throw new Error('NOT_FOUND');

        const updated = await tx.media.update({
            where: { id: input.mediaId },
            data: {
                moderationStatus: ModerationStatus.REJECTED,
                moderatedAt: now,
                moderatedById: input.moderatorId,
                moderationNotes: input.notes ?? null,
            },
            select: { id: true, moderationStatus: true },
        });

        await writeModerationLog({
            action: 'MEDIA_REJECT',
            targetType: 'media',
            targetId: updated.id,
            moderatorId: input.moderatorId,
            details: {
                from: before.moderationStatus,
                to: updated.moderationStatus,
                notes: input.notes ?? null,
                requestId: input.requestId,
            },
        });

        return updated;
    });
}
