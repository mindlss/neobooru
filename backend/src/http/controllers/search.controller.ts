import { Controller, Get, Query, Request, Route, Security, Tags } from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { prisma } from '../../lib/prisma';

import { apiError } from '../errors/ApiError';

import { searchQuerySchema } from '../schemas/search.schemas';
import { parseSearchQuery } from '../../domain/search/search.parser';
import { searchMedia, searchComics } from '../../domain/search/search.service';

import type { SearchResponseDTO } from '../dto/search.dto';
import { Scope } from '../../domain/auth/permissions';

import { computeIsAdult } from '../../domain/users/user.service';

type Viewer = { id?: string; isAdult: boolean } | undefined;

/**
 * Minimal viewer for search visibility:
 * - if no principal => guest viewer undefined
 * - if principal exists => check user exists + not deleted, compute isAdult
 */
async function loadViewer(req: ExpressRequest): Promise<Viewer> {
    if (!req.user?.id) return undefined;

    const u = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, birthDate: true, deletedAt: true },
    });

    if (!u || u.deletedAt) return undefined;

    return { id: u.id, isAdult: computeIsAdult(u.birthDate) };
}

@Route('search')
@Tags('Search')
export class SearchController extends Controller {
    /**
     * GET /search
     * public, permission-aware via principal (optional cookie auth)
     */
    @Get()
    @Security('optionalCookieAuth', [Scope.LOAD_PERMISSIONS])
    public async search(
        @Request() req: ExpressRequest,
        @Query('q') q?: string,
        @Query('limit') limit?: number,
        @Query('cursor') cursor?: string,
    ): Promise<SearchResponseDTO> {
        const parsedQuery = searchQuerySchema.parse({
            q: q ?? '',
            limit,
            cursor,
        });

        let parsed: any;
        try {
            parsed = parseSearchQuery(parsedQuery.q);
        } catch (e: any) {
            const msg = String(e?.message ?? '');
            const code =
                msg === 'BAD_SORT'
                    ? 'BAD_SORT'
                    : msg === 'BAD_FILTER'
                      ? 'BAD_FILTER'
                      : 'BAD_QUERY';

            throw apiError(400, code, 'Invalid query');
        }

        const viewer = await loadViewer(req);

        try {
            if (parsed.includeComic) {
                const result = await searchComics({
                    parsed,
                    viewer,
                    principal: req.user,
                    limit: parsedQuery.limit,
                    cursor: parsedQuery.cursor,
                });

                return {
                    meta: {
                        comicMode: true,
                        forcedByQuery: true,
                        excludedComic: false,
                    },
                    data: result.data,
                    nextCursor: result.nextCursor,
                };
            }

            const result = await searchMedia({
                parsed,
                viewer,
                principal: req.user,
                limit: parsedQuery.limit,
                cursor: parsedQuery.cursor,
            });

            return {
                meta: {
                    comicMode: false,
                    forcedByQuery: false,
                    excludedComic: !!parsed.excludeComic,
                },
                data: result.data,
                nextCursor: result.nextCursor,
            };
        } catch (e: any) {
            if (e?.message === 'RATIO_SORT_UNSUPPORTED') {
                throw apiError(
                    400,
                    'BAD_FILTER',
                    'ratio filter is only supported with date sorts (new/old) for now',
                );
            }
            throw e;
        }
    }
}
