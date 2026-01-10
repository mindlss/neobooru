import { asyncHandler } from '../utils/asyncHandler';
import { parseBody, parseQuery, parseParams } from '../utils/parse';
import { apiError } from '../errors/ApiError';
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
import { toCommentDTO } from '../dto';

export const listComments = asyncHandler(async (req, res) => {
    if (!req.viewer?.isAdult) {
        return res.json({ data: [], nextCursor: null });
    }

    const params = parseParams(mediaIdParamsSchema, req.params);
    const q = parseQuery(commentsListQuerySchema, req.query);

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

    res.json({
        data: result.data.map((c) =>
            toCommentDTO(c, req.viewer ? { role: req.viewer.role } : undefined)
        ),
        nextCursor: result.nextCursor,
    });
});

export const createMediaComment = asyncHandler(async (req, res) => {
    if (!req.currentUser || !req.viewer) {
        throw apiError(
            500,
            'INTERNAL_SERVER_ERROR',
            'currentUser/viewer not loaded'
        );
    }

    if (!req.viewer.isAdult) {
        throw apiError(403, 'COMMENT_UNDERAGE', 'Comments are 18+');
    }

    const params = parseParams(mediaIdParamsSchema, req.params);
    const body = parseBody(createCommentSchema, req.body);

    try {
        const created = await createComment({
            mediaId: params.id,
            userId: req.currentUser.id,
            viewer: req.viewer,
            content: body.content,
            parentId: body.parentId ?? null,
        });

        res.status(201).json(toCommentDTO(created, { role: req.viewer.role }));
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND') {
            throw apiError(404, 'NOT_FOUND', 'Media not found');
        }
        if (e?.message === 'PARENT_NOT_FOUND') {
            throw apiError(400, 'PARENT_NOT_FOUND', 'Parent comment not found');
        }
        throw e;
    }
});

export const deleteCommentById = asyncHandler(async (req, res) => {
    const id = String(req.params.id || '');

    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    const body = parseBody(deleteCommentSchema, req.body ?? {});

    try {
        await softDeleteComment({
            commentId: id,
            requester: { id: req.currentUser.id, role: req.currentUser.role },
            reason: body.reason,
        });

        res.json({ status: 'ok' });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND') {
            throw apiError(404, 'NOT_FOUND', 'Comment not found');
        }
        if (e?.message === 'FORBIDDEN') {
            throw apiError(403, 'FORBIDDEN', 'Not allowed');
        }
        throw e;
    }
});
