import { asyncHandler } from '../utils/asyncHandler';
import { parseBody, parseQuery } from '../utils/parse';
import {
    adminReportPatchSchema,
    adminReportsListQuerySchema,
    adminReportTargetsQuerySchema,
    createReportSchema,
} from '../schemas/reports.schemas';
import {
    createReport,
    listReportsAdmin,
    listReportTargetsAdmin,
    setReportStatusAdmin,
} from '../../domain/reports/reports.service';
import { toAdminReportDTO, toAdminReportTargetDTO } from '../dto';
import { apiError } from '../errors/ApiError';

export const create = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL', 'currentUser not loaded');
    }

    const body = parseBody(createReportSchema, req.body);

    await createReport({
        type: body.type,
        targetId: body.targetId,
        reason: body.reason,
        description: body.description ?? null,
        reportedById: req.currentUser.id,
    });

    res.status(201).json({ status: 'ok' });
});

export const adminList = asyncHandler(async (req, res) => {
    const q = parseQuery(adminReportsListQuerySchema, req.query);

    const result = await listReportsAdmin({
        limit: q.limit,
        cursor: q.cursor,
        status: q.status,
        type: q.type,
        order: q.order ?? 'old',
    });

    res.json({
        data: result.data.map(toAdminReportDTO),
        nextCursor: result.nextCursor,
    });
});

export const adminTargets = asyncHandler(async (req, res) => {
    const q = parseQuery(adminReportTargetsQuerySchema, req.query);

    const result = await listReportTargetsAdmin({
        limit: q.limit,
        page: q.page,
        type: q.type,
        status: q.status as any,
        order: q.order ?? 'count_desc',
    });

    res.json({
        data: result.data.map(toAdminReportTargetDTO),
        page: result.page,
        limit: result.limit,
        totalTargets: result.totalTargets,
        totalPages: result.totalPages,
    });
});

export const adminPatch = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL', 'currentUser not loaded');
    }

    const { id } = req.params;
    const body = parseBody(adminReportPatchSchema, req.body);

    const isResolved = body.status === 'resolved' || body.status === 'rejected';

    const updated = await setReportStatusAdmin({
        id,
        status: body.status,
        assignedToId:
            body.assignedToId !== undefined ? body.assignedToId : undefined,
        resolvedById: isResolved ? req.currentUser.id : undefined,
    });

    res.json({
        status: 'ok',
        id: updated.id,
        reportStatus: updated.status,
        assignedToId: updated.assignedToId ?? null,
        resolvedById: updated.resolvedById ?? null,
        updatedAt: new Date(updated.updatedAt).toISOString(),
    });
});
