import { asyncHandler } from '../utils/asyncHandler';
import { parseBody, parseParams } from '../utils/parse';
import { apiError } from '../errors/ApiError';
import {
    userIdParamsSchema,
    userPatchSelfSchema,
} from '../schemas/user.schemas';
import {
    getUserPublicById,
    getUserSelf,
    patchUserSelf,
} from '../../domain/users/user.service';
import { toUserPublicDTO, toUserSelfDTO } from '../dto';

import {
    parseAvatarMultipartToTemp,
    uploadUserAvatarFromTemp,
} from '../../domain/users/avatar.service';

export const getUserPublic = asyncHandler(async (req, res) => {
    const params = parseParams(userIdParamsSchema, req.params);

    const user = await getUserPublicById({
        userId: params.id,
        viewer: req.viewer,
    });
    if (!user) throw apiError(404, 'NOT_FOUND', 'User not found');

    res.json(toUserPublicDTO(user));
});

export const getMe = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    const user = await getUserSelf(req.currentUser.id);
    if (!user) throw apiError(401, 'UNAUTHORIZED', 'User not found');

    res.json(toUserSelfDTO(user));
});

export const patchMe = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    const body = parseBody(userPatchSelfSchema, req.body);

    const updated = await patchUserSelf({
        userId: req.currentUser.id,
        input: body,
    });

    res.json(toUserSelfDTO(updated));
});

export const uploadMyAvatar = asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'currentUser not loaded');
    }

    let parsed: { tmpPath: string; sha256: string; size: number };
    try {
        parsed = await parseAvatarMultipartToTemp(req);
    } catch (e: any) {
        const msg = e?.message;
        if (msg === 'NO_FILE') {
            throw apiError(400, 'NO_FILE', 'avatar file is required');
        }
        if (msg === 'FILE_TOO_LARGE') {
            throw apiError(413, 'FILE_TOO_LARGE', 'avatar too large');
        }
        throw apiError(400, 'BAD_MULTIPART', 'invalid multipart upload');
    }

    try {
        await uploadUserAvatarFromTemp({
            userId: req.currentUser.id,
            tmpPath: parsed.tmpPath,
            sha256: parsed.sha256,
        });
    } catch (e: any) {
        if (e?.message === 'UNSUPPORTED_AVATAR_TYPE') {
            throw apiError(
                415,
                'UNSUPPORTED_AVATAR_TYPE',
                'Allowed: jpeg/png/webp'
            );
        }
        throw e;
    }

    const me = await getUserSelf(req.currentUser.id);
    if (!me) throw apiError(401, 'UNAUTHORIZED', 'User not found');

    res.json(toUserSelfDTO(me));
});
