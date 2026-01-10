import { prisma } from '../../lib/prisma';

export type ReportCreateInput = {
    type: 'media' | 'comment';
    targetId: string;
    reason: string;
    description?: string | null;
    reportedById: string;
};

export type AdminReportListParams = {
    limit: number;
    cursor?: string;
    status?: 'pending' | 'reviewing' | 'resolved' | 'rejected';
    type?: 'media' | 'comment';
};

export async function createReport(input: ReportCreateInput) {
    const report = await prisma.report.create({
        data: {
            type: input.type,
            targetId: input.targetId,
            reason: input.reason,
            description: input.description ?? null,
            status: 'pending',
            reportedById: input.reportedById,
        },
        select: {
            id: true,
            type: true,
            targetId: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
        },
    });

    return report;
}

export async function listReportsAdmin(params: AdminReportListParams) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const items = await prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        select: {
            id: true,
            type: true,
            targetId: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            reportedById: true,
            assignedToId: true,
            resolvedById: true,
            reportedBy: { select: { id: true, username: true } },
            assignedTo: { select: { id: true, username: true } },
            resolvedBy: { select: { id: true, username: true } },
        },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    return { data: items.slice(0, take), nextCursor };
}

export async function setReportStatusAdmin(input: {
    id: string;
    status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
    assignedToId?: string | null;
    resolvedById?: string | null;
}) {
    const updated = await prisma.report.update({
        where: { id: input.id },
        data: {
            status: input.status,
            ...(input.assignedToId !== undefined
                ? { assignedToId: input.assignedToId }
                : {}),
            ...(input.resolvedById !== undefined
                ? { resolvedById: input.resolvedById }
                : {}),
        },
        select: {
            id: true,
            status: true,
            assignedToId: true,
            resolvedById: true,
            updatedAt: true,
        },
    });

    return updated;
}
