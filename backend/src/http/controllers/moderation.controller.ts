import {
    Body,
    Controller,
    Get,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { UserRole } from '@prisma/client';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned, requireRole } from '../tsoa/guards';

import {
    queueQuerySchema,
    moderationActionSchema,
} from '../schemas/moderation.schemas';

import {
    approveMedia,
    listPendingMedia,
    rejectMedia,
} from '../../domain/moderation/moderation.service';

import {
    toModerationQueueItemDTO,
    type ModerationQueueResponseDTO,
    type ModerationActionBodyDTO,
    type ModerationActionResponseDTO,
} from '../dto/moderation.dto';

@Route('moderation')
@Tags('Moderation')
export class ModerationController extends Controller {
    /**
     * GET /moderation/queue
     * Moderator/Admin only
     */
    @Get('queue')
    @Security('cookieAuth')
    public async getQueue(
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
    ): Promise<ModerationQueueResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const q = queueQuerySchema.parse({ limit, cursor });

        const result = await listPendingMedia({
            limit: q.limit,
            cursor: q.cursor,
        });

        return {
            data: result.data.map(toModerationQueueItemDTO),
            nextCursor: result.nextCursor ?? null,
        };
    }

    /**
     * POST /moderation/media/:id/approve
     * Moderator/Admin only
     */
    @Post('media/{id}/approve')
    @Security('cookieAuth')
    public async approve(
        @Path() id: string,
        @Body() body: ModerationActionBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ModerationActionResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const data = moderationActionSchema.parse(body);

        try {
            const updated = await approveMedia({
                mediaId: id,
                moderatorId: req.currentUser!.id,
                notes: data.notes,
                requestId: (req as any).requestId,
            });

            return {
                status: 'ok',
                mediaId: updated.id,
                moderationStatus: updated.moderationStatus,
            };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            throw e;
        }
    }

    /**
     * POST /moderation/media/:id/reject
     * Moderator/Admin only
     */
    @Post('media/{id}/reject')
    @Security('cookieAuth')
    public async reject(
        @Path() id: string,
        @Body() body: ModerationActionBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ModerationActionResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const data = moderationActionSchema.parse(body);

        try {
            const updated = await rejectMedia({
                mediaId: id,
                moderatorId: req.currentUser!.id,
                notes: data.notes,
                requestId: (req as any).requestId,
            });

            return {
                status: 'ok',
                mediaId: updated.id,
                moderationStatus: updated.moderationStatus,
            };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            throw e;
        }
    }
}
