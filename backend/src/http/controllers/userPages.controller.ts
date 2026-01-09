import { asyncHandler } from '../utils/asyncHandler';
import { parseParams, parseQuery } from '../utils/parse';
import { apiError } from '../errors/ApiError';
import { userIdParamsSchema } from '../schemas/user.schemas';
import { mediaListQuerySchema } from '../schemas/media.schemas';
import {
    listUserFavorites,
    listUserUploads,
} from '../../domain/users/userPages.service';
import { toMediaDTO } from '../dto';

export const getUserUploads = asyncHandler(async (req, res) => {
    const params = parseParams(userIdParamsSchema, req.params);
    const q = parseQuery(mediaListQuerySchema, req.query);

    const result = await listUserUploads({
        userId: params.id,
        viewer: req.viewer,
        limit: q.limit,
        cursor: q.cursor,
        sort: q.sort,
        type: q.type,
    });

    if (result.kind === 'not_found') {
        throw apiError(404, 'NOT_FOUND', 'User not found');
    }
    if (result.kind === 'private') {
        throw apiError(403, 'PROFILE_PRIVATE', 'Uploads are hidden');
    }

    res.json({
        data: result.data.map((m) =>
            toMediaDTO(m, req.viewer ? { role: req.viewer.role } : undefined)
        ),
        nextCursor: result.nextCursor,
    });
});

export const getUserFavorites = asyncHandler(async (req, res) => {
    const params = parseParams(userIdParamsSchema, req.params);
    const q = parseQuery(mediaListQuerySchema, req.query);

    const result = await listUserFavorites({
        userId: params.id,
        viewer: req.viewer,
        limit: q.limit,
        cursor: q.cursor,
        sort: q.sort,
        type: q.type,
    });

    if (result.kind === 'not_found') {
        throw apiError(404, 'NOT_FOUND', 'User not found');
    }
    if (result.kind === 'private') {
        throw apiError(403, 'PROFILE_PRIVATE', 'Favorites are hidden');
    }

    res.json({
        data: result.data.map((m) =>
            toMediaDTO(m, req.viewer ? { role: req.viewer.role } : undefined)
        ),
        nextCursor: result.nextCursor,
    });
});

// placeholders until comments/ratings are implemented
export const getUserComments = asyncHandler(async (_req, _res) => {
    throw apiError(
        501,
        'NOT_IMPLEMENTED',
        'User comments are not implemented yet'
    );
});

export const getUserRatings = asyncHandler(async (_req, _res) => {
    throw apiError(
        501,
        'NOT_IMPLEMENTED',
        'User ratings are not implemented yet'
    );
});
