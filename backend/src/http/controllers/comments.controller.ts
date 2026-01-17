import {
    Body,
    Controller,
    Delete,
    Get,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { apiError } from '../errors/ApiError';
import { ensureViewer, requireCurrentUser } from '../tsoa/context';

import { mediaIdParamsSchema } from '../schemas/media.schemas';
import {
    commentsListQuerySchema,
    createCommentSchema,
    deleteCommentSchema,
} from '../schemas/comments.schemas';

import {
    createComment,
    listCommentsForMedia,
    softDeleteComment,
} from '../../domain/comments/comments.service';

import { toCommentDTO, type CommentDTO } from '../dto/comment.dto';
import type { OkDTO } from '../dto/common.dto';

// -------------------- Swagger DTOs --------------------

type CommentsListResponseDTO = {
    data: CommentDTO[];
    nextCursor: string | null;
};

type CreateCommentBodyDTO = {
    content: string;
    parentId?: string | null;
};

type DeleteCommentBodyDTO = {
    reason?: string;
};

// -------------------- Controller --------------------

@Route('')
@Tags('Comments')
export class CommentsController extends Controller {
    /**
     * List comments for media (viewer-aware, public)
     * GET /media/:id/comments
     */
    @Get('media/{id}/comments')
    @Security('optionalCookieAuth')
    public async listComments(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: string
    ): Promise<CommentsListResponseDTO> {
        // guest | user
        await ensureViewer(req);

        if (!req.viewer?.isAdult) {
            throw apiError(403, 'COMMENTS_ADULTS_ONLY', 'Comments are 18+');
        }

        const params = mediaIdParamsSchema.parse({ id });
        const q = commentsListQuerySchema.parse({ limit, cursor, sort });

        const result = await listCommentsForMedia({
            mediaId: params.id,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
        });

        if (result.kind === 'not_found') {
            throw apiError(404, 'NOT_FOUND', 'Media not found');
        }

        return {
            data: result.data.map((c) =>
                toCommentDTO(
                    c,
                    req.viewer ? { role: req.viewer.role } : undefined
                )
            ),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Create comment (auth required)
     * POST /media/:id/comments
     */
    @Post('media/{id}/comments')
    @Security('cookieAuth')
    @SuccessResponse(201, 'Created')
    public async createMediaComment(
        @Path() id: string,
        @Body() body: CreateCommentBodyDTO,
        @Request() req: ExpressRequest
    ): Promise<CommentDTO> {
        // guarantees currentUser + viewer
        await requireCurrentUser(req);

        if (!req.viewer?.isAdult) {
            throw apiError(403, 'COMMENT_UNDERAGE', 'Comments are 18+');
        }

        const params = mediaIdParamsSchema.parse({ id });
        const parsedBody = createCommentSchema.parse(body);

        try {
            const created = await createComment({
                mediaId: params.id,
                userId: req.currentUser!.id,
                viewer: req.viewer!,
                content: parsedBody.content,
                parentId: parsedBody.parentId ?? null,
            });

            this.setStatus(201);
            return toCommentDTO(created, { role: req.viewer!.role });
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            if (e?.message === 'PARENT_NOT_FOUND') {
                throw apiError(
                    400,
                    'PARENT_NOT_FOUND',
                    'Parent comment not found'
                );
            }
            throw e;
        }
    }

    /**
     * Soft-delete comment (owner or mod/admin)
     * DELETE /comments/:id
     */
    @Delete('comments/{id}')
    @Security('cookieAuth')
    public async deleteCommentById(
        @Path() id: string,
        @Body() body: DeleteCommentBodyDTO,
        @Request() req: ExpressRequest
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        if (!req.viewer?.isAdult) {
            throw apiError(403, 'COMMENTS_ADULTS_ONLY', 'Comments are 18+');
        }

        const parsedBody = deleteCommentSchema.parse(body ?? {});
        const commentId = String(id || '');

        try {
            await softDeleteComment({
                commentId,
                requester: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
                reason: parsedBody.reason,
            });

            return { status: 'ok' };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comment not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Not allowed');
            }
            throw e;
        }
    }
}
