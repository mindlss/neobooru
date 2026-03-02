import {
    Body,
    Controller,
    Delete,
    Get,
    Path,
    Patch,
    Post,
    Request,
    Route,
    Security,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned } from '../tsoa/guards';

import {
    comicIdParamsSchema,
    createComicBodySchema,
    updateComicBodySchema,
    addPageBodySchema,
    removePageParamsSchema,
    reorderPagesBodySchema,
} from '../schemas/comics.schemas';

import {
    createComic,
    updateComic,
    getComic,
    addComicPage,
    removeComicPage,
    reorderComicPages,
} from '../../domain/comics/comics.service';

import {
    toComicDTO,
    type ComicResponseDTO,
    type CreateComicBodyDTO,
    type UpdateComicBodyDTO,
    type AddComicPageBodyDTO,
    type ReorderComicPagesBodyDTO,
    type OkResponseDTO,
} from '../dto/comics.dto';

import { Scope, Permission } from '../../domain/auth/permissions';

@Route('comics')
@Tags('Comics')
export class ComicsController extends Controller {
    /**
     * POST /comics
     * auth required + not banned + permissions loaded
     */
    @Post()
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.COMICS_CREATE])
    public async createComic(
        @Body() body: CreateComicBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const data = createComicBodySchema.parse(body);

        try {
            const created = await createComic({
                title: data.title,
                principal: req.user!,
            });

            this.setStatus(201);

            const full = await getComic({
                comicId: created.id,
                principal: req.user!,
            });

            return { data: toComicDTO(full) };
        } catch (e: any) {
            if (e?.message === 'TITLE_INVALID') {
                throw apiError(400, 'TITLE_INVALID', 'Invalid title');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * GET /comics/:id
     * auth required + perms loaded
     */
    @Get('{id}')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async getComic(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const params = comicIdParamsSchema.parse({ id });

        try {
            const data = await getComic({
                comicId: params.id,
                principal: req.user!,
            });
            return { data: toComicDTO(data) };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comic not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * PATCH /comics/:id
     */
    @Patch('{id}')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async updateComic(
        @Path() id: string,
        @Body() body: UpdateComicBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const params = comicIdParamsSchema.parse({ id });
        const data = updateComicBodySchema.parse(body);

        try {
            await updateComic({
                comicId: params.id,
                principal: req.user!,
                ...data,
            });

            const full = await getComic({
                comicId: params.id,
                principal: req.user!,
            });

            return { data: toComicDTO(full) };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comic not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            if (e?.message === 'MEDIA_NOT_FOUND') {
                throw apiError(404, 'MEDIA_NOT_FOUND', 'Media not found');
            }
            if (e?.message === 'FORBIDDEN_MEDIA') {
                throw apiError(403, 'FORBIDDEN', 'Cannot use this media');
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * POST /comics/:id/pages
     */
    @Post('{id}/pages')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async addComicPage(
        @Path() id: string,
        @Body() body: AddComicPageBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const params = comicIdParamsSchema.parse({ id });
        const data = addPageBodySchema.parse(body);

        try {
            await addComicPage({
                comicId: params.id,
                mediaId: data.mediaId,
                position: data.position,
                principal: req.user!,
            });

            this.setStatus(201);

            const full = await getComic({
                comicId: params.id,
                principal: req.user!,
            });

            return { data: toComicDTO(full) };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comic not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            if (e?.message === 'MEDIA_NOT_FOUND') {
                throw apiError(404, 'MEDIA_NOT_FOUND', 'Media not found');
            }
            if (e?.message === 'FORBIDDEN_MEDIA') {
                throw apiError(403, 'FORBIDDEN', 'Cannot use this media');
            }
            if (e?.message === 'ALREADY_IN_COMIC') {
                throw apiError(
                    409,
                    'ALREADY_IN_COMIC',
                    'Media already in comic',
                );
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * DELETE /comics/:id/pages/:mediaId
     */
    @Delete('{id}/pages/{mediaId}')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async removeComicPage(
        @Path() id: string,
        @Path() mediaId: string,
        @Request() req: ExpressRequest,
    ): Promise<OkResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const params = removePageParamsSchema.parse({ id, mediaId });

        try {
            await removeComicPage({
                comicId: params.id,
                mediaId: params.mediaId,
                principal: req.user!,
            });
            return { ok: true };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comic not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * POST /comics/:id/pages/reorder
     */
    @Post('{id}/pages/reorder')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async reorderPages(
        @Path() id: string,
        @Body() body: ReorderComicPagesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const params = comicIdParamsSchema.parse({ id });
        const data = reorderPagesBodySchema.parse(body);

        try {
            await reorderComicPages({
                comicId: params.id,
                orderedMediaIds: data.orderedMediaIds,
                principal: req.user!,
            });

            return { ok: true };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Comic not found');
            }
            if (e?.message === 'FORBIDDEN') {
                throw apiError(403, 'FORBIDDEN', 'Forbidden');
            }
            if (e?.message === 'BAD_ORDER_LENGTH') {
                throw apiError(400, 'BAD_ORDER_LENGTH', 'Bad order length');
            }
            if (e?.message === 'BAD_ORDER_MEDIA') {
                throw apiError(400, 'BAD_ORDER_MEDIA', 'Bad order media');
            }
            if (e?.message === 'BAD_ORDER_DUP') {
                throw apiError(
                    400,
                    'BAD_ORDER_DUP',
                    'Duplicate media in order',
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
