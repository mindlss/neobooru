import {
    Controller,
    Get,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { apiError } from '../errors/ApiError';
import { ensureViewer, requireCurrentUser } from '../tsoa/context';

import { RestrictionType, UserRole } from '@prisma/client';

import { mediaListQuerySchema } from '../schemas/media.schemas';

import {
    getMediaByIdOrBlocked,
    listMediaVisible,
} from '../../domain/media/media.service';

import {
    parseMultipartToTemp,
    uploadMediaFromTemp,
} from '../../domain/media/upload.service';

import {
    toMediaDTO,
    toMediaUploadDTO,
    type MediaPublicDTO,
    type MediaUserDTO,
    type MediaModeratorDTO,
    type MediaUploadDTO,
} from '../dto/media.dto';

import {
    requireNotBanned,
    requireRole,
    requireNoActiveRestriction,
} from '../tsoa/guards';

// -------------------- Swagger DTOs --------------------

type MediaVisibleDTO = MediaPublicDTO | MediaUserDTO | MediaModeratorDTO;

type MediaListResponseDTO = {
    data: MediaVisibleDTO[];
    nextCursor: string | null;
};

// -------------------- Controller --------------------

@Route('media')
@Tags('Media')
export class MediaController extends Controller {
    /**
     * GET /media/:id
     * public, viewer-aware
     */
    @Get('{id}')
    @Security('optionalCookieAuth')
    public async getMedia(
        @Path() id: string,
        @Request() req: ExpressRequest
    ): Promise<MediaVisibleDTO> {
        await ensureViewer(req);

        const result = await getMediaByIdOrBlocked(id, req.viewer);

        if (result.kind === 'ok') {
            return toMediaDTO(
                result.media!,
                req.viewer ? { role: req.viewer.role } : undefined
            ) as MediaVisibleDTO;
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
                    'Media is not available yet'
                );

            case 'REJECTED':
                throw apiError(403, 'NOT_AVAILABLE', 'Media is not available');

            case 'DELETED':
                throw apiError(410, 'DELETED', 'Media was deleted');
        }
    }

    /**
     * GET /media
     * public, viewer-aware
     */
    @Get()
    @Security('optionalCookieAuth')
    public async listMedia(
        @Request() req: ExpressRequest,
        @Query() limit?: number,
        @Query() cursor?: string,
        @Query() sort?: string,
        @Query() type?: string
    ): Promise<MediaListResponseDTO> {
        await ensureViewer(req);

        const q = mediaListQuerySchema.parse({ limit, cursor, sort, type });

        const result = await listMediaVisible({
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
            sort: q.sort,
            type: q.type,
        });

        return {
            data: result.data.map((m) =>
                toMediaDTO(
                    m,
                    req.viewer ? { role: req.viewer.role } : undefined
                )
            ) as MediaVisibleDTO[],
            nextCursor: result.nextCursor,
        };
    }

    /**
     * POST /media/upload
     * auth required, role restricted, ban + restriction checks
     *
     * NOTE: multipart parsing is implemented by parseMultipartToTemp(req).
     * Swagger multipart form can be added later via tsoa+multer config.
     */
    @Post('upload')
    @Security('cookieAuth')
    @SuccessResponse(201, 'Created')
    public async uploadMedia(
        @Request() req: ExpressRequest
    ): Promise<MediaUploadDTO> {
        // loads req.currentUser + req.viewer (and throws 401 if missing)
        await requireCurrentUser(req);

        requireNotBanned(req.currentUser);

        requireRole(req.viewer!.role, [
            UserRole.TRUSTED,
            UserRole.MODERATOR,
            UserRole.ADMIN,
        ]);

        await requireNoActiveRestriction(req.currentUser!.id, [
            RestrictionType.UPLOAD_BAN,
            RestrictionType.FULL_BAN,
        ]);

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
                uploadedById: req.currentUser!.id,
                description: parsed.description,
                tagsRaw: parsed.tagsRaw,
            });

            this.setStatus(201);
            return toMediaUploadDTO(media);
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

            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong'
            );
        }
    }
}
