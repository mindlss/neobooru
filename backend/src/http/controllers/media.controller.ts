import { asyncHandler } from '../utils/asyncHandler';
import {
    parseMultipartToTemp,
    uploadMediaFromTemp,
} from '../../domain/media/upload.service';
import { toMediaUploadDTO } from '../dto';
import { apiError } from '../errors/ApiError';

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
