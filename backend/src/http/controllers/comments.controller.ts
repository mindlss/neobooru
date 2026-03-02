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
import { requireCurrentUser } from '../tsoa/context';

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

import { Permission, Scope } from '../../domain/auth/permissions';

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

@Route('')
@Tags('Comments')
export class CommentsController extends Controller {
    /**
     * GET /media/:id/comments
     * Скрываем эндпоинт через permission (если нет perms -> 401/403 на auth этапе)
     */
    @Get('media/{id}/comments')
    @Security('cookieAuth', [Permission.COMMENTS_READ])
    public async listComments(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: string,
    ): Promise<CommentsListResponseDTO> {
        const params = mediaIdParamsSchema.parse({ id });
        const q = commentsListQuerySchema.parse({ limit, cursor, sort });

        const result = await listCommentsForMedia({
            mediaId: params.id,
            principal: req.user,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
        });

        if (result.kind === 'not_found') {
            throw apiError(404, 'NOT_FOUND', 'Media not found');
        }

        return {
            data: result.data.map((c) =>
                // DTO у тебя всё ещё на viewer.role — оставляем совместимость:
                // если user есть — даём role из БД в comment.user.role, а viewer роль тут не критична
                toCommentDTO(
                    c,
                    req.user
                        ? ({ role: (c.user as any).role } as any)
                        : undefined,
                ),
            ),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * POST /media/:id/comments
     */
    @Post('media/{id}/comments')
    @Security('cookieAuth', [Permission.COMMENTS_CREATE])
    @SuccessResponse(201, 'Created')
    public async createMediaComment(
        @Path() id: string,
        @Body() body: CreateCommentBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<CommentDTO> {
        await requireCurrentUser(req);

        const params = mediaIdParamsSchema.parse({ id });
        const parsedBody = createCommentSchema.parse(body);

        try {
            const created = await createComment({
                mediaId: params.id,
                principal: req.user,
                userId: req.currentUser!.id,
                content: parsedBody.content,
                parentId: parsedBody.parentId ?? null,
            });

            this.setStatus(201);
            return toCommentDTO(
                created,
                req.user
                    ? ({ role: (created.user as any).role } as any)
                    : undefined,
            );
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            if (e?.message === 'PARENT_NOT_FOUND') {
                throw apiError(
                    400,
                    'PARENT_NOT_FOUND',
                    'Parent comment not found',
                );
            }
            throw e;
        }
    }

    /**
     * DELETE /comments/:id
     * any-of (own or any) -> поэтому только LOAD_PERMISSIONS, а дальше доменная проверка.
     */
    @Delete('comments/{id}')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async deleteCommentById(
        @Path() id: string,
        @Body() body: DeleteCommentBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        const parsedBody = deleteCommentSchema.parse(body ?? {});
        const commentId = String(id || '');

        try {
            await softDeleteComment({
                commentId,
                principal: req.user,
                requesterId: req.currentUser!.id,
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
