import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export async function writeModerationLog(input: {
    action: string;
    targetType: string;
    targetId: string;
    moderatorId: string;
    details?: Prisma.InputJsonObject;
}) {
    return prisma.moderationLog.create({
        data: {
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            moderatorId: input.moderatorId,
            ...(input.details !== undefined ? { details: input.details } : {}),
        },
    });
}
