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
import { UserRole } from '@prisma/client';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned, requireRole } from '../tsoa/guards';

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

const comicRoles: UserRole[] = [
    UserRole.USER,
    UserRole.TRUSTED,
    UserRole.MODERATOR,
    UserRole.ADMIN,
];

@Route('comics')
@Tags('Comics')
export class ComicsController extends Controller {
    /**
     * POST /comics
     * auth required + not banned + role allowed
     */
    @Post()
    @Security('cookieAuth')
    public async createComic(
        @Body() body: CreateComicBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const data = createComicBodySchema.parse(body);

        try {
            const created = await createComic({
                title: data.title,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
            });

            this.setStatus(201);
            const full = await getComic({
                comicId: created.id,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
            });

            return { data: toComicDTO(full) };
        } catch (e: any) {
            if (e?.message === 'TITLE_INVALID') {
                throw apiError(400, 'TITLE_INVALID', 'Invalid title');
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
     * auth required (по твоему роутеру)
     */
    @Get('{id}')
    @Security('cookieAuth')
    public async getComic(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const params = comicIdParamsSchema.parse({ id });

        try {
            const data = await getComic({
                comicId: params.id,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
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
    @Security('cookieAuth')
    public async updateComic(
        @Path() id: string,
        @Body() body: UpdateComicBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const params = comicIdParamsSchema.parse({ id });
        const data = updateComicBodySchema.parse(body);

        try {
            await updateComic({
                comicId: params.id,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
                ...data,
            });

            const full = await getComic({
                comicId: params.id,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
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
    @Security('cookieAuth')
    public async addComicPage(
        @Path() id: string,
        @Body() body: AddComicPageBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<ComicResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const params = comicIdParamsSchema.parse({ id });
        const data = addPageBodySchema.parse(body);

        try {
            await addComicPage({
                comicId: params.id,
                mediaId: data.mediaId,
                position: data.position,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
            });

            this.setStatus(201);

            const full = await getComic({
                comicId: params.id,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
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
    @Security('cookieAuth')
    public async removeComicPage(
        @Path() id: string,
        @Path() mediaId: string,
        @Request() req: ExpressRequest,
    ): Promise<OkResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const params = removePageParamsSchema.parse({ id, mediaId });

        try {
            await removeComicPage({
                comicId: params.id,
                mediaId: params.mediaId,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
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
    @Security('cookieAuth')
    public async reorderPages(
        @Path() id: string,
        @Body() body: ReorderComicPagesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, comicRoles);

        const params = comicIdParamsSchema.parse({ id });
        const data = reorderPagesBodySchema.parse(body);

        try {
            await reorderComicPages({
                comicId: params.id,
                orderedMediaIds: data.orderedMediaIds,
                viewer: {
                    id: req.currentUser!.id,
                    role: req.currentUser!.role,
                },
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
