import { asyncHandler } from '../utils/asyncHandler';
import {
    parseMultipartToTemp,
    uploadMediaFromTemp,
} from '../../domain/media/upload.service';
import { toMediaUploadDTO } from '../dto';

export const uploadMedia = asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    }

    let parsed;
    try {
        parsed = await parseMultipartToTemp(req);
    } catch (e: any) {
        const msg = e?.message;

        if (msg === 'NO_FILE') {
            return res.status(400).json({
                error: { code: 'NO_FILE', message: 'file is required' },
            });
        }

        if (msg === 'FILE_TOO_LARGE') {
            return res.status(413).json({ error: { code: 'FILE_TOO_LARGE' } });
        }

        return res.status(400).json({
            error: {
                code: 'BAD_MULTIPART',
                message: 'invalid multipart upload',
            },
        });
    }

    try {
        const media = await uploadMediaFromTemp({
            tmpPath: parsed.tmpPath,
            sha256: parsed.sha256,
            size: parsed.size,
            mimeType: parsed.mimeType,
            uploadedById: req.user.id,
        });

        return res.status(201).json(toMediaUploadDTO(media));
    } catch (e: any) {
        const msg = e?.message;

        if (msg === 'BLOCKED_HASH') {
            return res.status(403).json({
                error: {
                    code: 'BLOCKED_HASH',
                    message: 'file hash is blocked',
                },
            });
        }

        if (msg === 'DUPLICATE_HASH') {
            return res.status(409).json({
                error: {
                    code: 'DUPLICATE_HASH',
                    message: 'file already exists',
                },
            });
        }

        if (msg === 'UNSUPPORTED_MEDIA_TYPE') {
            return res
                .status(415)
                .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
        }

        return res.status(500).json({ error: { code: 'INTERNAL' } });
    }
});
