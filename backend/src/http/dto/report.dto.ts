export type ReportCreatedDTO = {
    id: string;
    type: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: string;
};

export function toReportCreatedDTO(r: any): ReportCreatedDTO {
    return {
        id: r.id,
        type: r.type,
        targetId: r.targetId,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
    };
}

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
