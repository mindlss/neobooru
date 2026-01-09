import { asyncHandler } from '../utils/asyncHandler';
import { parseParams } from '../utils/parse';
import { apiError } from '../errors/ApiError';
import { mediaIdParamsSchema } from '../schemas/media.schemas';
import {
    addFavorite,
    removeFavorite,
} from '../../domain/media/favorites.service';

export const favorite = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    const params = parseParams(mediaIdParamsSchema, req.params);

    await addFavorite({ userId: req.currentUser.id, mediaId: params.id });

    res.json({ status: 'ok' });
});

export const unfavorite = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    const params = parseParams(mediaIdParamsSchema, req.params);

    await removeFavorite({ userId: req.currentUser.id, mediaId: params.id });

    res.json({ status: 'ok' });
});
