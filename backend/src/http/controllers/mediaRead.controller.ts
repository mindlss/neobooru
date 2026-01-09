import { asyncHandler } from '../utils/asyncHandler';
import { mediaListQuerySchema } from '../schemas/media.schemas';
import {
    getMediaByIdVisible,
    listMediaVisible,
} from '../../domain/media/mediaRead.service';
import { toMediaDTO } from '../dto';
import { parseQuery } from '../utils/parse';

export const getMedia = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const media = await getMediaByIdVisible(id, req.viewer);
    if (!media) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

    res.json(
        toMediaDTO(media, req.viewer ? { role: req.viewer.role } : undefined)
    );
});

export const listMedia = asyncHandler(async (req, res) => {
    const q = parseQuery(mediaListQuerySchema, req.query);

    const result = await listMediaVisible({
        viewer: req.viewer,
        limit: q.limit,
        cursor: q.cursor,
        sort: q.sort,
        type: q.type,
    });

    res.json({
        data: result.data.map((m) =>
            toMediaDTO(m, req.viewer ? { role: req.viewer.role } : undefined)
        ),
        nextCursor: result.nextCursor,
    });
});
