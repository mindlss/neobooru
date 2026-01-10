import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export type ReportCreateInput = {
    type: 'media' | 'comment';
    targetId: string;
    reason: string;
    description?: string | null;
    reportedById: string;
};

const UNRESOLVED_STATUSES = ['pending', 'reviewing'] as const;
type UnresolvedStatus = (typeof UNRESOLVED_STATUSES)[number];

export type AdminReportListParams = {
    limit: number;
    cursor?: string;

    status?: 'pending' | 'reviewing' | 'resolved' | 'rejected';
    type?: 'media' | 'comment';

    order?: 'old' | 'new';
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
        select: { id: true },
    });

    return report;
}

export async function listReportsAdmin(params: AdminReportListParams) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const where: Prisma.ReportWhereInput = {};
    if (params.type) where.type = params.type;

    if (params.status) where.status = params.status;
    else where.status = { in: [...UNRESOLVED_STATUSES] };

    const orderBy: Prisma.ReportOrderByWithRelationInput =
        (params.order ?? 'old') === 'new'
            ? { createdAt: 'desc' }
            : { createdAt: 'asc' };

    const items = await prisma.report.findMany({
        where,
        orderBy,
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
    return prisma.report.update({
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
}

// ==================== Aggregation for admin panel ====================

export type AdminReportTargetsParams = {
    limit: number;
    page: number;
    type?: 'media' | 'comment';
    status?: UnresolvedStatus | 'resolved' | 'rejected';
    order?: 'count_desc' | 'count_asc' | 'oldest_first' | 'newest_first';
};

type TargetRow = {
    type: string;
    targetId: string;
    reportCount: number;
    firstReportedAt: Date;
    lastReportedAt: Date;
};

function buildWhere(params: AdminReportTargetsParams): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};
    if (params.type) where.type = params.type;

    if (params.status) where.status = params.status;
    else where.status = { in: [...UNRESOLVED_STATUSES] };

    return where;
}

export async function listReportTargetsAdmin(params: AdminReportTargetsParams) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const page = Math.max(params.page, 1);
    const skip = (page - 1) * take;

    const where = buildWhere(params);
    const order = params.order ?? 'count_desc';

    const totalDistinct = await prisma.report.findMany({
        where,
        distinct: ['type', 'targetId'],
        select: { type: true, targetId: true },
    });

    if (order === 'count_desc' || order === 'count_asc') {
        const rows = await prisma.report.groupBy({
            by: ['type', 'targetId'],
            where,
            _count: { id: true },
            _min: { createdAt: true },
            _max: { createdAt: true },
            orderBy:
                order === 'count_asc'
                    ? ({ _count: { id: 'asc' } } as const)
                    : ({ _count: { id: 'desc' } } as const),
            skip,
            take,
        });

        const data: TargetRow[] = rows.map((r) => ({
            type: r.type,
            targetId: r.targetId,
            reportCount: r._count?.id ?? 0,
            firstReportedAt: r._min?.createdAt ?? new Date(0),
            lastReportedAt: r._max?.createdAt ?? new Date(0),
        }));

        return {
            data,
            page,
            limit: take,
            totalTargets: totalDistinct.length,
            totalPages: Math.max(1, Math.ceil(totalDistinct.length / take)),
        };
    }

    const statusFilter =
        params.status ?? (UNRESOLVED_STATUSES as unknown as string[]);

    const typeFilter = params.type ?? null;

    const statusWhereSql = Array.isArray(statusFilter)
        ? Prisma.sql`r."status" IN (${Prisma.join(statusFilter)})`
        : Prisma.sql`r."status" = ${statusFilter}`;

    const typeWhereSql = typeFilter
        ? Prisma.sql`AND r."type" = ${typeFilter}`
        : Prisma.empty;

    const timeOrderSql =
        order === 'newest_first'
            ? Prisma.sql`MAX(r."createdAt") DESC`
            : Prisma.sql`MIN(r."createdAt") ASC`;

    const rows = await prisma.$queryRaw<TargetRow[]>(Prisma.sql`
        SELECT
            r."type" as "type",
            r."targetId" as "targetId",
            COUNT(r."id")::int as "reportCount",
            MIN(r."createdAt") as "firstReportedAt",
            MAX(r."createdAt") as "lastReportedAt"
        FROM "Report" r
        WHERE ${statusWhereSql}
        ${typeWhereSql}
        GROUP BY r."type", r."targetId"
        ORDER BY ${timeOrderSql}, COUNT(r."id") DESC
        OFFSET ${skip}
        LIMIT ${take}
    `);

    return {
        data: rows,
        page,
        limit: take,
        totalTargets: totalDistinct.length,
        totalPages: Math.max(1, Math.ceil(totalDistinct.length / take)),
    };
}
