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
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned } from '../tsoa/guards';

import {
    userIdParamsSchema,
    userPatchSelfSchema,
} from '../schemas/user.schemas';
import { mediaListQuerySchema } from '../schemas/media.schemas';

import { prisma } from '../../lib/prisma';
import { Permission, Scope } from '../../domain/auth/permissions';

import {
    computeIsAdult,
    getUserPublicById,
    getUserSelf,
    patchUserSelf,
    getUserRoleKeys,
} from '../../domain/users/user.service';

import {
    listUserFavorites,
    listUserUploads,
    listUserComments,
    listUserRatings,
} from '../../domain/users/userPages.service';

import { uploadUserAvatarFromTemp } from '../../domain/users/avatar.service';

import { toUserPublicDTO, toUserSelfDTO } from '../dto/user.dto';
import { type MediaVisibleDTO, toMediaDTO } from '../dto/media.dto';
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

async function loadViewer(
    req: ExpressRequest,
): Promise<{ id?: string; isAdult: boolean } | undefined> {
    if (!req.user?.id) return undefined;

    const u = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, birthDate: true, deletedAt: true },
    });

    if (!u || u.deletedAt) return undefined;

    return { id: u.id, isAdult: computeIsAdult(u.birthDate) };
}

function dtoViewerFromReq(
    req: ExpressRequest,
): { permissions?: string[] } | undefined {
    if (!req.user) return undefined;
    return { permissions: req.user.permissions ?? [] };
}

function principalFromReq(req: ExpressRequest) {
    if (!req.user?.id) return undefined;
    return { id: req.user.id, permissions: req.user.permissions ?? [] };
}

@Route('users')
@Tags('Users')
export class UsersController extends Controller {
    /**
     * GET /users/me
     */
    @Get('me')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async getMe(@Request() req: ExpressRequest): Promise<UserSelfDTO> {
        await requireCurrentUser(req);

        const user = await getUserSelf(req.user!.id);
        if (!user) throw apiError(401, 'UNAUTHORIZED', 'User not found');

        const roles = await getUserRoleKeys(req.user!.id);

        return toUserSelfDTO({
            ...user,
            roles,
            permissions: req.user?.permissions ?? [],
        });
    }

    /**
     * GET /users/:id
     */
    @Get('{id}')
    @Security('optionalCookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_READ,
    ])
    public async getUserPublic(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<UserPublicDTO> {
        const params = userIdParamsSchema.parse({ id });
        const viewer = await loadViewer(req);

        const user = await getUserPublicById({
            userId: params.id,
            principal: principalFromReq(req),
            viewer,
        });

        if (!user) throw apiError(404, 'NOT_FOUND', 'User not found');
        return toUserPublicDTO(user);
    }

    @Get('{id}/uploads')
    @Security('optionalCookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_READ,
    ])
    public async getUserUploads(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserMediaListResponseDTO> {
        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const viewer = await loadViewer(req);

        const result = await listUserUploads({
            userId: params.id,
            principal: principalFromReq(req),
            viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Uploads are hidden');

        const dtoViewer = dtoViewerFromReq(req);

        return {
            data: result.data.map((m) =>
                toMediaDTO(m, dtoViewer),
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    @Get('{id}/favorites')
    @Security('optionalCookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_READ,
    ])
    public async getUserFavorites(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserMediaListResponseDTO> {
        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const viewer = await loadViewer(req);

        const result = await listUserFavorites({
            userId: params.id,
            principal: principalFromReq(req),
            viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Favorites are hidden');

        const dtoViewer = dtoViewerFromReq(req);

        return {
            data: result.data.map((m) =>
                toMediaDTO(m, dtoViewer),
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    @Get('{id}/comments')
    @Security('optionalCookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_READ,
    ])
    public async getUserComments(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
    ): Promise<UserCommentsListResponseDTO> {
        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema
            .pick({ limit: true, cursor: true, sort: true })
            .parse({ limit, cursor, sort });

        const viewer = await loadViewer(req);

        const result = await listUserComments({
            userId: params.id,
            principal: principalFromReq(req),
            viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Comments are hidden');

        const principal = principalFromReq(req);

        return {
            data: result.data.map((c: any) => toCommentDTO(c, principal)),
            nextCursor: result.nextCursor,
        };
    }

    @Get('{id}/ratings')
    @Security('optionalCookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_READ,
    ])
    public async getUserRatings(
        @Path() id: string,
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: 'new' | 'old',
        @Query() type?: 'IMAGE' | 'VIDEO',
    ): Promise<UserRatingsListResponseDTO> {
        const params = userIdParamsSchema.parse({ id });
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const viewer = await loadViewer(req);

        const result = await listUserRatings({
            userId: params.id,
            principal: principalFromReq(req),
            viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        if (result.kind === 'not_found')
            throw apiError(404, 'NOT_FOUND', 'User not found');
        if (result.kind === 'private')
            throw apiError(403, 'PROFILE_PRIVATE', 'Ratings are hidden');

        const dtoViewer = dtoViewerFromReq(req);

        return {
            data: result.data.map(
                (x: any): UserRatingItemDTO => ({
                    value: x.value,
                    media: toMediaDTO(x.media, dtoViewer) as MediaVisibleDTO,
                }),
            ),
            nextCursor: result.nextCursor,
        };
    }

    /**
     * PATCH /users/me
     */
    @Patch('me')
    @Security('cookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_UPDATE_SELF,
    ])
    public async patchMe(
        @Request() req: ExpressRequest,
        @Body() body: unknown,
    ): Promise<UserSelfDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const data = userPatchSelfSchema.parse(body);

        const updated = await patchUserSelf({
            userId: req.user!.id,
            principal: principalFromReq(req)!,
            input: data,
        });

        return toUserSelfDTO(updated);
    }

    /**
     * POST /users/me/avatar
     */
    @Post('me/avatar')
    @Security('cookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.USERS_AVATAR_UPDATE_SELF,
    ])
    public async uploadMyAvatar(
        @Request() req: ExpressRequest,
        @UploadedFile('avatar') avatar?: Express.Multer.File,
    ): Promise<UserSelfDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        if (!avatar?.path)
            throw apiError(400, 'NO_FILE', 'avatar file is required');

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
                userId: req.user!.id,
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
            if (e?.message === 'NO_FILE')
                throw apiError(400, 'NO_FILE', 'avatar file is required');
            if (e?.message === 'FILE_TOO_LARGE')
                throw apiError(413, 'FILE_TOO_LARGE', 'avatar too large');
            throw e;
        }

        const me = await getUserSelf(req.user!.id);
        if (!me) throw apiError(401, 'UNAUTHORIZED', 'User not found');

        return toUserSelfDTO(me);
    }
}
