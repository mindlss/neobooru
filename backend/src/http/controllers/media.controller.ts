import {
    Consumes,
    Controller,
    FormField,
    Get,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
    UploadedFile,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';

import { RestrictionType } from '@prisma/client';

import { mediaListQuerySchema } from '../schemas/media.schemas';

import {
    getMediaByIdOrBlocked,
    listMediaVisible,
} from '../../domain/media/media.service';

import { uploadMediaFromMulterFile } from '../../domain/media/upload.service';

import {
    toMediaDTO,
    toMediaUploadDTO,
    type MediaUploadDTO,
    type MediaVisibleDTO,
    type MediaListResponseDTO,
} from '../dto/media.dto';

import { requireNotBanned, requireNoActiveRestriction } from '../tsoa/guards';

import { Permission, Scope } from '../../domain/auth/permissions';

@Route('media')
@Tags('Media')
export class MediaController extends Controller {
    /**
     * GET /media/:id
     * public, principal-aware (optional auth)
     */
    @Get('{id}')
    @Security('optionalCookieAuth', [Scope.LOAD_PERMISSIONS])
    public async getMedia(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<MediaVisibleDTO> {
        const result = await getMediaByIdOrBlocked(id, req.user);

        if (result.kind === 'ok') {
            // Передаём principal как viewer-like.
            return toMediaDTO(result.media!, req.user) as MediaVisibleDTO;
        }

        switch (result.reason) {
            case 'NOT_FOUND':
                throw apiError(404, 'NOT_FOUND', 'Media not found');

            case 'EXPLICIT':
                throw apiError(403, 'EXPLICIT_ONLY', 'This media is 18+');

            case 'PENDING':
                throw apiError(
                    403,
                    'NOT_AVAILABLE',
                    'Media is not available yet',
                );

            case 'REJECTED':
                throw apiError(403, 'NOT_AVAILABLE', 'Media is not available');

            case 'DELETED':
                throw apiError(410, 'DELETED', 'Media was deleted');
        }
    }

    /**
     * GET /media
     * public, principal-aware (optional auth)
     */
    @Get()
    @Security('optionalCookieAuth', [Scope.LOAD_PERMISSIONS])
    public async listMedia(
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: string,
        @Query() type?: string,
    ): Promise<MediaListResponseDTO> {
        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const result = await listMediaVisible({
            principal: req.user,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        return {
            data: result.data.map((m) =>
                toMediaDTO(m, req.user),
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    /**
     * POST /media/upload
     * auth required + perms + ban + restriction checks
     */
    @Post('upload')
    @Consumes('multipart/form-data')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.MEDIA_UPLOAD])
    @SuccessResponse(201, 'Created')
    public async uploadMedia(
        @Request() req: ExpressRequest,
        @UploadedFile('file') file?: Express.Multer.File,
        @FormField() description?: string,
        @FormField() tags?: string,
    ): Promise<MediaUploadDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser!.id, [
            RestrictionType.UPLOAD_BAN,
            RestrictionType.FULL_BAN,
        ]);

        if (!file) {
            throw apiError(400, 'NO_FILE', 'file is required');
        }

        try {
            const media = await uploadMediaFromMulterFile({
                file,
                uploadedById: req.currentUser!.id,
                description,
                tagsRaw: tags,
            });

            this.setStatus(201);
            return toMediaUploadDTO(media);
        } catch (e: any) {
            if (
                e?.message === 'FILE_TOO_LARGE' ||
                e?.code === 'LIMIT_FILE_SIZE'
            ) {
                throw apiError(413, 'FILE_TOO_LARGE', 'File too large');
            }
            if (e?.message === 'BLOCKED_HASH') {
                throw apiError(403, 'BLOCKED_HASH', 'file hash is blocked');
            }
            if (e?.message === 'DUPLICATE_HASH') {
                throw apiError(409, 'DUPLICATE_HASH', 'file already exists');
            }
            if (e?.message === 'UNSUPPORTED_MEDIA_TYPE') {
                throw apiError(
                    415,
                    'UNSUPPORTED_MEDIA_TYPE',
                    'unsupported media type',
                );
            }

            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }
}
