import { asyncHandler } from '../utils/asyncHandler';
import { mediaListQuerySchema } from '../schemas/media.schemas';
import {
    getMediaByIdVisible,
    listMediaVisible,
} from '../../domain/media/media.service';
import { toMediaDTO, toMediaUploadDTO } from '../dto';
import { parseQuery } from '../utils/parse';
import { apiError } from '../errors/ApiError';
import {
    parseMultipartToTemp,
    uploadMediaFromTemp,
} from '../../domain/media/upload.service';

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

export const uploadMedia = asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw apiError(401, 'UNAUTHORIZED', 'Missing auth');
    }

    let parsed: any;
    try {
        parsed = await parseMultipartToTemp(req);
    } catch (e: any) {
        const msg = e?.message;

        if (msg === 'NO_FILE') {
            throw apiError(400, 'NO_FILE', 'file is required');
        }

        if (msg === 'FILE_TOO_LARGE') {
            throw apiError(413, 'FILE_TOO_LARGE', 'File too large');
        }

        throw apiError(400, 'BAD_MULTIPART', 'invalid multipart upload');
    }

    try {
        const media = await uploadMediaFromTemp({
            tmpPath: parsed.tmpPath,
            sha256: parsed.sha256,
            size: parsed.size,
            mimeType: parsed.mimeType,
            uploadedById: req.user.id,
            description: parsed.description,
            tagsRaw: parsed.tagsRaw,
        });

        return res.status(201).json(toMediaUploadDTO(media));
    } catch (e: any) {
        const msg = e?.message;

        if (msg === 'BLOCKED_HASH') {
            throw apiError(403, 'BLOCKED_HASH', 'file hash is blocked');
        }

        if (msg === 'DUPLICATE_HASH') {
            throw apiError(409, 'DUPLICATE_HASH', 'file already exists');
        }

        if (msg === 'UNSUPPORTED_MEDIA_TYPE') {
            throw apiError(
                415,
                'UNSUPPORTED_MEDIA_TYPE',
                'unsupported media type'
            );
        }

        // Unknown upload error
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});
