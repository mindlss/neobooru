import { asyncHandler } from '../utils/asyncHandler';
import { mediaListQuerySchema } from '../schemas/media.schemas';
import {
    getMediaByIdVisible,
    listMediaVisible,
} from '../../domain/media/mediaRead.service';

import { toMediaDTO } from '../dto';

export const getMedia = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const media = await getMediaByIdVisible(id, req.user);
    if (!media) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

    res.json(toMediaDTO(media, req.user));
});

export const listMedia = asyncHandler(async (req, res) => {
    const q = mediaListQuerySchema.parse(req.query);

    const result = await listMediaVisible({
        user: req.user,
        limit: q.limit,
        cursor: q.cursor,
        sort: q.sort,
        type: q.type,
    });

    res.json({
        data: result.data.map((m) => toMediaDTO(m, req.user)),
        nextCursor: result.nextCursor,
    });
});
