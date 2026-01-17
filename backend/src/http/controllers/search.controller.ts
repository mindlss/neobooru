import { Controller, Get, Query, Request, Route, Security, Tags } from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { apiError } from '../errors/ApiError';
import { ensureViewer } from '../tsoa/context';

import { searchQuerySchema } from '../schemas/search.schemas';
import { parseSearchQuery } from '../../domain/search/search.parser';
import { searchMedia, searchComics } from '../../domain/search/search.service';

import type { SearchResponseDTO } from '../dto/search.dto';

@Route('search')
@Tags('Search')
export class SearchController extends Controller {
    /**
     * GET /search
     * public, viewer-aware
     */
    @Get()
    @Security('optionalCookieAuth')
    public async search(
        @Request() req: ExpressRequest,
        @Query('q') q?: string,
        @Query('limit') limit?: number,
        @Query('cursor') cursor?: string,
    ): Promise<SearchResponseDTO> {
        await ensureViewer(req);

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

        try {
            if (parsed.includeComic) {
                const result = await searchComics({
                    parsed,
                    viewer: req.viewer,
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
                viewer: req.viewer,
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
