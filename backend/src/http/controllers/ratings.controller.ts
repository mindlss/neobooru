import { asyncHandler } from '../utils/asyncHandler';
import { parseBody, parseParams } from '../utils/parse';
import { apiError } from '../errors/ApiError';
import { mediaIdParamsSchema } from '../schemas/media.schemas';
import { setRatingSchema } from '../schemas/ratings.schemas';
import { removeRating, setRating } from '../../domain/ratings/ratings.service';

export const rateMedia = asyncHandler(async (req, res) => {
    if (!req.currentUser || !req.viewer?.id) {
        throw apiError(
            500,
            'INTERNAL_SERVER_ERROR',
            'currentUser/viewer not loaded'
        );
    }

    const params = parseParams(mediaIdParamsSchema, req.params);
    const body = parseBody(setRatingSchema, req.body);

    try {
        const result = await setRating({
            mediaId: params.id,
            userId: req.currentUser.id,
            value: body.value,
            viewer: {
                id: req.viewer.id!,
                role: req.viewer.role,
                isAdult: req.viewer.isAdult,
            },
        });

        res.json({ status: 'ok', ...result });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND') {
            throw apiError(404, 'NOT_FOUND', 'Media not found');
        }
        throw e;
    }
});

export const unrateMedia = asyncHandler(async (req, res) => {
    if (!req.currentUser || !req.viewer?.id) {
        throw apiError(
            500,
            'INTERNAL_SERVER_ERROR',
            'currentUser/viewer not loaded'
        );
    }

    const params = parseParams(mediaIdParamsSchema, req.params);

    try {
        const result = await removeRating({
            mediaId: params.id,
            userId: req.currentUser.id,
            viewer: {
                id: req.viewer.id!,
                role: req.viewer.role,
                isAdult: req.viewer.isAdult,
            },
        });

        res.json({ status: 'ok', ...result });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND') {
            throw apiError(404, 'NOT_FOUND', 'Media not found');
        }
        throw e;
    }
});
