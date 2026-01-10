export type AdminReportDTO = {
    id: string;
    type: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;

    createdAt: string;
    updatedAt: string;

    reportedById: string;
    reportedByUsername: string;

    assignedToId: string | null;
    assignedToUsername: string | null;

    resolvedById: string | null;
    resolvedByUsername: string | null;
};

export function toAdminReportDTO(r: any): AdminReportDTO {
    return {
        id: r.id,
        type: r.type,
        targetId: r.targetId,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,

        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),

        reportedById: r.reportedById,
        reportedByUsername: r.reportedBy?.username ?? '',

        assignedToId: r.assignedToId ?? null,
        assignedToUsername: r.assignedTo?.username ?? null,

        resolvedById: r.resolvedById ?? null,
        resolvedByUsername: r.resolvedBy?.username ?? null,
    };
}

export type AdminReportTargetDTO = {
    type: string;
    targetId: string;
    reportCount: number;
    firstReportedAt: string;
    lastReportedAt: string;
};

export function toAdminReportTargetDTO(r: any): AdminReportTargetDTO {
    return {
        type: r.type,
        targetId: r.targetId,
        reportCount: r.reportCount,
        firstReportedAt: new Date(r.firstReportedAt).toISOString(),
        lastReportedAt: new Date(r.lastReportedAt).toISOString(),
    };
}
