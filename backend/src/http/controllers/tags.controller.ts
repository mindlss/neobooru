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

import { UserRole } from '@prisma/client';

import { ensureViewer, requireCurrentUser } from '../tsoa/context';
import { requireRole } from '../tsoa/guards';

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
    TagAliasesListResponseDTO,
    TagNamesBodyDTO,
    CreateTagBodyDTO,
    PatchTagBodyDTO,
    CreateAliasBodyDTO,
    TagSuggestListResponseDTO,
    TagSearchListResponseDTO,
} from '../dto/tag.dto';

import type { OkDTO } from '../dto/common.dto';

@Route('')
@Tags('Tags')
export class TagsController extends Controller {
    // public (viewer-aware)
    @Get('tags/search')
    @Security('optionalCookieAuth')
    public async search(
        @Request() req: ExpressRequest,
        @Query('q') q: string,
        @Query('limit') limit?: number,
    ): Promise<TagSuggestListResponseDTO> {
        await ensureViewer(req);

        const parsed = tagSearchSchema.parse({ q, limit });

        const rows = await searchTagsAutocomplete({
            q: parsed.q,
            limit: parsed.limit,
            viewer: req.viewer,
        });

        return { data: rows.map(toTagSuggestDTO) };
    }

    @Get('tags/popular')
    @Security('optionalCookieAuth')
    public async popular(
        @Request() req: ExpressRequest,
        @Query('limit') limit?: number,
    ): Promise<TagSearchListResponseDTO> {
        await ensureViewer(req);

        const parsed = tagPopularSchema.parse({ limit });

        const tags = await listPopularTags({
            limit: parsed.limit,
            viewer: req.viewer,
        });

        return { data: tags.map(toTagSearchDTO) };
    }

    // admin/mod
    @Post('tags')
    @Security('cookieAuth')
    @SuccessResponse(201, 'Created')
    public async create(
        @Body() body: CreateTagBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<any> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = createTagSchema.parse(body);
        const tag = await createTag(parsed);

        this.setStatus(201);
        return tag;
    }

    @Patch('tags/{id}')
    @Security('cookieAuth')
    public async patch(
        @Path() id: string,
        @Body() body: PatchTagBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<TagAdminDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = patchTagSchema.parse(body);
        const updated = await patchTag(id, parsed);

        return toTagAdminDTO(updated);
    }

    // aliases (admin/mod)
    @Get('tags/{id}/aliases')
    @Security('cookieAuth')
    public async listTagAliases(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<TagAliasesListResponseDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const rows = await listAliasesForTag(id);
        return { data: rows };
    }

    @Post('tags/{id}/aliases')
    @Security('cookieAuth')
    @SuccessResponse(201, 'Created')
    public async createTagAlias(
        @Path() id: string,
        @Body() body: CreateAliasBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<any> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = createAliasSchema.parse(body);
        const created = await createAlias({ tagId: id, alias: parsed.alias });

        this.setStatus(201);
        return created;
    }

    @Delete('tags/aliases/{id}')
    @Security('cookieAuth')
    public async deleteTagAlias(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        await deleteAlias(id);
        return { status: 'ok' };
    }

    // media tags set/add/remove (admin/mod)
    @Post('media/{id}/tags')
    @Security('cookieAuth')
    public async setTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = tagNamesSchema.parse(body);
        await setTagsForMedia(id, parsed.tags);

        return { status: 'ok' };
    }

    @Post('media/{id}/tags/add')
    @Security('cookieAuth')
    public async addTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = tagNamesSchema.parse(body);
        await addTagsToMedia(id, parsed.tags);

        return { status: 'ok' };
    }

    @Post('media/{id}/tags/remove')
    @Security('cookieAuth')
    public async removeTags(
        @Path() id: string,
        @Body() body: TagNamesBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);
        requireRole(req.viewer?.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const parsed = tagNamesSchema.parse(body);
        await removeTagsFromMedia(id, parsed.tags);

        return { status: 'ok' };
    }
}
