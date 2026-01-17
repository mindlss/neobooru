import {
    Body,
    Controller,
    Get,
    Patch,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    Tags,
    UploadedFile,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';

import { apiError } from '../errors/ApiError';
import { ensureViewer, requireCurrentUser } from '../tsoa/context';
import { requireNotBanned } from '../tsoa/guards';

import {
    userIdParamsSchema,
    userPatchSelfSchema,
} from '../schemas/user.schemas';
import { mediaListQuerySchema } from '../schemas/media.schemas';

import {
    getUserPublicById,
    getUserSelf,
    patchUserSelf,
} from '../../domain/users/user.service';

import {
    listUserFavorites,
    listUserUploads,
    listUserComments,
    listUserRatings,
} from '../../domain/users/userPages.service';

import { uploadUserAvatarFromTemp } from '../../domain/users/avatar.service';

import { toUserPublicDTO, toUserSelfDTO } from '../dto/user.dto';
import { MediaVisibleDTO, toMediaDTO } from '../dto/media.dto';
import { toCommentDTO } from '../dto/comment.dto';

import type {
    UserPublicDTO,
    UserSelfDTO,
    UserMediaListResponseDTO,
    UserCommentsListResponseDTO,
    UserRatingsListResponseDTO,
    UserRatingItemDTO,
} from '../dto/user.dto';

async function sha256File(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const s = createReadStream(filepath);
        s.on('error', reject);
        s.on('data', (chunk) => hash.update(chunk));
        s.on('end', () => resolve(hash.digest('hex')));
    });
}

@Route('users')
@Tags('Users')
export class UsersController extends Controller {
    /**
     * GET /users/:id
     * public profile, viewer-aware
     */
    @Get('{id}')
    @Security('optionalCookieAuth')
    public async getUserPublic(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<UserPublicDTO> {
        await ensureViewer(req);

        const params = userIdParamsSchema.parse({ id });

        const user = await getUserPublicById({
            userId: params.id,
            viewer: req.viewer,
        });
        if (!user) throw apiError(404, 'NOT_FOUND', 'User not found');

        return toUserPublicDTO(user);
    }

    /**
     * GET /users/:id/uploads
     */
    @Get('{id}/uploads')
    @Security('optionalCookieAuth')
    public async getUserUploads(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserMediaListResponseDTO> {
        await ensureViewer(req);

        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const result = await listUserUploads({
            userId: params.id,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Uploads are hidden');

        return {
            data: result.data.map((m) =>
                toMediaDTO(
                    m,
                    req.viewer ? { role: req.viewer.role } : undefined,
                ),
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    /**
     * GET /users/:id/favorites
     */
    @Get('{id}/favorites')
    @Security('optionalCookieAuth')
    public async getUserFavorites(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserMediaListResponseDTO> {
        await ensureViewer(req);

        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const result = await listUserFavorites({
            userId: params.id,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Favorites are hidden');

        return {
            data: result.data.map((m) =>
                toMediaDTO(
                    m,
                    req.viewer ? { role: req.viewer.role } : undefined,
                ),
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    /**
     * GET /users/:id/comments
     */
    @Get('{id}/comments')
    @Security('optionalCookieAuth')
    public async getUserComments(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
    ): Promise<UserCommentsListResponseDTO> {
        await ensureViewer(req);

        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema
            .pick({ limit: true, cursor: true, sort: true })
            .parse({ limit, cursor, sort });

        const result = await listUserComments({
            userId: params.id,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Comments are hidden');

        return {
            data: result.data.map((c: any) =>
                toCommentDTO(
                    c,
                    req.viewer ? { role: req.viewer.role } : undefined,
                ),
            ),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * GET /users/:id/ratings
     */
    @Get('{id}/ratings')
    @Security('optionalCookieAuth')
    public async getUserRatings(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserRatingsListResponseDTO> {
        await ensureViewer(req);

        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const result = await listUserRatings({
            userId: params.id,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Ratings are hidden');

        return {
            data: result.data.map(
                (x: any): UserRatingItemDTO => ({
                    value: x.value,
                    media: toMediaDTO(
                        x.media,
                        req.viewer ? { role: req.viewer.role } : undefined,
                    ) as MediaVisibleDTO,
                }),
            ),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * GET /users/me
     * auth required
     */
    @Get('me')
    @Security('cookieAuth')
    public async getMe(@Request() req: ExpressRequest): Promise<UserSelfDTO> {
        await requireCurrentUser(req);

        const user = await getUserSelf(req.currentUser!.id);
        if (!user) throw apiError(401, 'UNAUTHORIZED', 'User not found');

        return toUserSelfDTO(user);
    }

    /**
     * PATCH /users/me
     * auth required + not banned
     */
    @Patch('me')
    @Security('cookieAuth')
    public async patchMe(
        @Request() req: ExpressRequest,
        @Body() body: unknown,
    ): Promise<UserSelfDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const data = userPatchSelfSchema.parse(body);

        const updated = await patchUserSelf({
            userId: req.currentUser!.id,
            input: data,
        });

        return toUserSelfDTO(updated);
    }

    /**
     * POST /users/me/avatar
     * multipart/form-data: avatar (file)
     */
    @Post('me/avatar')
    @Security('cookieAuth')
    public async uploadMyAvatar(
        @Request() req: ExpressRequest,
        @UploadedFile('avatar') avatar?: Express.Multer.File,
    ): Promise<UserSelfDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        if (!avatar?.path) {
            throw apiError(400, 'NO_FILE', 'avatar file is required');
        }

        const tmpPath = avatar.path;

        let sha256: string;
        try {
            sha256 = await sha256File(tmpPath);
        } catch {
            await fs.unlink(tmpPath).catch(() => {});
            throw apiError(400, 'BAD_MULTIPART', 'invalid multipart upload');
        }

        try {
            await uploadUserAvatarFromTemp({
                userId: req.currentUser!.id,
                tmpPath,
                sha256,
            });
        } catch (e: any) {
            await fs.unlink(tmpPath).catch(() => {});

            if (e?.message === 'UNSUPPORTED_AVATAR_TYPE') {
                throw apiError(
                    415,
                    'UNSUPPORTED_AVATAR_TYPE',
                    'Allowed: jpeg/png/webp',
                );
            }
            if (e?.message === 'NO_FILE') {
                throw apiError(400, 'NO_FILE', 'avatar file is required');
            }
            if (e?.message === 'FILE_TOO_LARGE') {
                throw apiError(413, 'FILE_TOO_LARGE', 'avatar too large');
            }
            throw e;
        }

        const me = await getUserSelf(req.currentUser!.id);
        if (!me) throw apiError(401, 'UNAUTHORIZED', 'User not found');

        return toUserSelfDTO(me);
    }
}
