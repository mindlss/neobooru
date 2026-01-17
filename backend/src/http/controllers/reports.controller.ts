import {
    Body,
    Controller,
    Get,
    Patch,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { RestrictionType, UserRole } from '@prisma/client';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import {
    requireNoActiveRestriction,
    requireNotBanned,
    requireRole,
} from '../tsoa/guards';

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

import {
    toAdminReportDTO,
    toAdminReportTargetDTO,
    type CreateReportBodyDTO,
    type AdminReportPatchBodyDTO,
    type AdminReportsListResponseDTO,
    type AdminReportTargetsResponseDTO,
    type CreateReportResponseDTO,
    type AdminReportPatchResponseDTO,
} from '../dto/reports.dto';

@Route()
@Tags('Reports')
export class ReportsController extends Controller {
    /**
     * POST /reports
     * auth required + not banned + restriction checks
     */
    @Post('reports')
    @Security('cookieAuth')
    public async create(
        @Body() body: CreateReportBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<CreateReportResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser!.id, [
            RestrictionType.REPORT_BAN,
            RestrictionType.FULL_BAN,
        ]);

        const data = createReportSchema.parse(body);

        await createReport({
            type: data.type,
            targetId: data.targetId,
            reason: data.reason,
            description: data.description ?? null,
            reportedById: req.currentUser!.id,
        });

        this.setStatus(201);
        return { status: 'ok' };
    }

    /**
     * GET /admin/reports
     * Moderator/Admin only
     */
    @Get('admin/reports')
    @Security('cookieAuth')
    public async adminList(
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() status?: 'pending' | 'reviewing' | 'resolved' | 'rejected',
        @Query() type?: 'media' | 'comment',
        @Query() order?: 'old' | 'new',
    ): Promise<AdminReportsListResponseDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const q = adminReportsListQuerySchema.parse({
            limit,
            cursor,
            status,
            type,
            order,
        });

        const result = await listReportsAdmin({
            limit: q.limit,
            cursor: q.cursor,
            status: q.status,
            type: q.type,
            order: q.order ?? 'old',
        });

        return {
            data: result.data.map(toAdminReportDTO),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * GET /admin/reports/targets
     * Moderator/Admin only
     */
    @Get('admin/reports/targets')
    @Security('cookieAuth')
    public async adminTargets(
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() page?: number,
        @Query() type?: 'media' | 'comment',
        @Query() status?: 'pending' | 'reviewing' | 'resolved' | 'rejected',
        @Query()
        order?: 'count_desc' | 'count_asc' | 'oldest_first' | 'newest_first',
    ): Promise<AdminReportTargetsResponseDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const q = adminReportTargetsQuerySchema.parse({
            limit,
            page,
            type,
            status,
            order,
        });

        const result = await listReportTargetsAdmin({
            limit: q.limit,
            page: q.page,
            type: q.type,
            status: q.status as any,
            order: q.order ?? 'count_desc',
        });

        return {
            data: result.data.map(toAdminReportTargetDTO),
            page: result.page,
            limit: result.limit,
            totalTargets: result.totalTargets,
            totalPages: result.totalPages,
        };
    }

    /**
     * PATCH /admin/reports/:id
     * Moderator/Admin only
     */
    @Patch('admin/reports/{id}')
    @Security('cookieAuth')
    public async adminPatch(
        @Path() id: string,
        @Body() body: AdminReportPatchBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<AdminReportPatchResponseDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const data = adminReportPatchSchema.parse(body);

        const isResolved =
            data.status === 'resolved' || data.status === 'rejected';

        const updated = await setReportStatusAdmin({
            id,
            status: data.status,
            assignedToId:
                data.assignedToId !== undefined ? data.assignedToId : undefined,
            resolvedById: isResolved ? req.currentUser!.id : undefined,
        });

        return {
            status: 'ok',
            id: updated.id,
            reportStatus: updated.status,
            assignedToId: updated.assignedToId ?? null,
            resolvedById: updated.resolvedById ?? null,
            updatedAt: new Date(updated.updatedAt).toISOString(),
        };
    }
}
