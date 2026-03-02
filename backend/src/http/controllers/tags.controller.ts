import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
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

import { prisma } from '../../lib/prisma';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';

import {
    tagNamesSchema,
    tagSearchSchema,
    tagPopularSchema,
    createTagSchema,
    patchTagSchema,
    createAliasSchema,
} from '../schemas/tag.schemas';

import {
    addTagsToMedia,
    removeTagsFromMedia,
    setTagsForMedia,
    searchTagsAutocomplete,
    listPopularTags,
    createTag,
    patchTag,
    createAlias,
    deleteAlias,
    listAliasesForTag,
} from '../../domain/tags/tags.service';

import {
    toTagAdminDTO,
    toTagSuggestDTO,
    toTagSearchDTO,
    type TagAdminDTO,
    type TagAliasesListResponseDTO,
    type TagNamesBodyDTO,
    type CreateTagBodyDTO,
    type PatchTagBodyDTO,
    type CreateAliasBodyDTO,
    type TagSuggestListResponseDTO,
    type TagSearchListResponseDTO,
} from '../dto/tag.dto';

import type { OkDTO } from '../dto/common.dto';

import { Permission, Scope } from '../../domain/auth/permissions';
import { computeIsAdult } from '../../domain/users/user.service';
import { hasPermission } from '../../domain/auth/permission.utils';

async function loadViewerForTags(
    req: ExpressRequest,
): Promise<{ id?: string; isAdult: boolean } | undefined> {
    if (!req.user?.id) return undefined;

    if (hasPermission(req.user, Permission.MEDIA_READ_EXPLICIT)) {
        return { id: req.user.id, isAdult: true };
    }

    const u = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, birthDate: true, deletedAt: true },
    });

    if (!u || u.deletedAt) return undefined;

    return { id: u.id, isAdult: computeIsAdult(u.birthDate) };
}

@Route('')
@Tags('Tags')
export class TagsController extends Controller {
    /**
     * GET /tags/search
     * public (optional auth), viewer-aware
     */
    @Get('tags/search')
    @Security('optionalCookieAuth', [Scope.LOAD_PERMISSIONS])
    public async search(
        @Request() req: ExpressRequest,
        @Query('q') q: string,
        @Query('limit') limit?: number,
    ): Promise<TagSuggestListResponseDTO> {
        const parsed = tagSearchSchema.parse({ q, limit });
        const viewer = await loadViewerForTags(req);

        const rows = await searchTagsAutocomplete({
            q: parsed.q,
            limit: parsed.limit,
            viewer,
            principal: req.user,
        });

        return { data: rows.map(toTagSuggestDTO) };
    }

    /**
     * GET /tags/popular
     * public (optional auth), viewer-aware
     */
    @Get('tags/popular')
    @Security('optionalCookieAuth', [Scope.LOAD_PERMISSIONS])
    public async popular(
        @Request() req: ExpressRequest,
        @Query('limit') limit?: number,
    ): Promise<TagSearchListResponseDTO> {
        const parsed = tagPopularSchema.parse({ limit });
        const viewer = await loadViewerForTags(req);

        const tags = await listPopularTags({
            limit: parsed.limit,
            viewer,
            principal: req.user,
        });

        return { data: tags.map(toTagSearchDTO) };
    }

    /**
     * POST /tags
     * staff: TAGS_MANAGE
     */
    @Post('tags')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.TAGS_MANAGE])
    @SuccessResponse(201, 'Created')
    public async create(
        @Body() body: CreateTagBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<any> {
        await requireCurrentUser(req);

        const parsed = createTagSchema.parse(body);

        try {
            const tag = await createTag(parsed);
            this.setStatus(201);
            return tag;
        } catch (e: any) {
            if (e?.message === 'GENERAL_CATEGORY_MISSING') {
                throw apiError(
                    500,
                    'INTERNAL_SERVER_ERROR',
                    'General category missing',
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
     * PATCH /tags/:id
     * staff: TAGS_MANAGE
     */
    @Patch('tags/{id}')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.TAGS_MANAGE])
    public async patch(
        @Path() id: string,
        @Body() body: PatchTagBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<TagAdminDTO> {
        await requireCurrentUser(req);

        const parsed = patchTagSchema.parse(body);

        try {
            const updated = await patchTag(id, parsed);
            return toTagAdminDTO(updated);
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Tag not found');
            }
            throw apiError(
                500,
                'INTERNAL_SERVER_ERROR',
                'Something went wrong',
            );
        }
    }

    /**
     * GET /tags/:id/aliases
     * staff: TAGS_ALIASES_MANAGE
     */
    @Get('tags/{id}/aliases')
    @Security('cookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.TAGS_ALIASES_MANAGE,
    ])
    public async listTagAliases(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<TagAliasesListResponseDTO> {
        await requireCurrentUser(req);

        const rows = await listAliasesForTag(id);
        return { data: rows };
    }

    /**
     * POST /tags/:id/aliases
     * staff: TAGS_ALIASES_MANAGE
     */
    @Post('tags/{id}/aliases')
    @Security('cookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.TAGS_ALIASES_MANAGE,
    ])
    @SuccessResponse(201, 'Created')
    public async createTagAlias(
        @Path() id: string,
        @Body() body: CreateAliasBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<any> {
        await requireCurrentUser(req);

        const parsed = createAliasSchema.parse(body);

        try {
            const created = await createAlias({
                tagId: id,
                alias: parsed.alias,
            });
            this.setStatus(201);
            return created;
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Tag not found');
            }
            if (e?.message === 'ALIAS_INVALID') {
                throw apiError(400, 'ALIAS_INVALID', 'Invalid alias');
            }
            if (e?.message === 'ALIAS_SAME_AS_TAG') {
                throw apiError(
                    409,
                    'ALIAS_SAME_AS_TAG',
                    'Alias equals canonical tag',
                );
            }
            if (e?.message === 'ALIAS_COLLIDES_WITH_TAG') {
                throw apiError(
                    409,
                    'ALIAS_COLLIDES_WITH_TAG',
                    'Alias collides with existing tag',
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
     * DELETE /tags/aliases/:id
     * staff: TAGS_ALIASES_MANAGE
     */
    @Delete('tags/aliases/{id}')
    @Security('cookieAuth', [
        Scope.LOAD_PERMISSIONS,
        Permission.TAGS_ALIASES_MANAGE,
    ])
    public async deleteTagAlias(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        await deleteAlias(id);
        return { status: 'ok' };
    }

    /**
     * POST /media/:id/tags
     * needs perms in principal (service checks):
     * - MEDIA_TAGS_EDIT_ANY OR (MEDIA_TAGS_EDIT_OWN + owner)
     */
    @Post('media/{id}/tags')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async setTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        const parsed = tagNamesSchema.parse(body);

        try {
            await setTagsForMedia({
                mediaId: id,
                tagNames: parsed.tags,
                principal: req.user!,
            });
            return { status: 'ok' };
        } catch (e: any) {
            if (e?.message === 'MEDIA_NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
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
     * POST /media/:id/tags/add
     */
    @Post('media/{id}/tags/add')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async addTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        const parsed = tagNamesSchema.parse(body);

        try {
            await addTagsToMedia({
                mediaId: id,
                tagNames: parsed.tags,
                principal: req.user!,
            });
            return { status: 'ok' };
        } catch (e: any) {
            if (e?.message === 'MEDIA_NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
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
     * POST /media/:id/tags/remove
     */
    @Post('media/{id}/tags/remove')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS])
    public async removeTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        const parsed = tagNamesSchema.parse(body);

        try {
            await removeTagsFromMedia({
                mediaId: id,
                tagNames: parsed.tags,
                principal: req.user!,
            });
            return { status: 'ok' };
        } catch (e: any) {
            if (e?.message === 'MEDIA_NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
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
}
