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
