import { asyncHandler } from '../utils/asyncHandler';
import { parseQuery } from '../utils/parse';
import { searchQuerySchema } from '../schemas/search.schemas';
import { parseSearchQuery } from '../../domain/search/search.parser';
import { searchMedia, searchComics } from '../../domain/search/search.service';

export const searchHandler = asyncHandler(async (req, res) => {
    const q = parseQuery(searchQuerySchema, req.query);

    let parsed;
    try {
        parsed = parseSearchQuery(q.q);
    } catch (e: any) {
        const msg = String(e?.message ?? '');
        const code =
            msg === 'BAD_SORT'
                ? 'BAD_SORT'
                : msg === 'BAD_FILTER'
                ? 'BAD_FILTER'
                : 'BAD_QUERY';

        return res.status(400).json({
            error: { code, message: 'Invalid query' },
        });
    }

    // special: ratio filter is supported but only for date sorts in media mode (service enforces)
    try {
        if (parsed.includeComic) {
            const result = await searchComics({
                parsed,
                viewer: req.viewer,
                limit: q.limit,
                cursor: q.cursor,
            });

            return res.json({
                meta: {
                    comicMode: true,
                    forcedByQuery: true,
                    excludedComic: false,
                },
                data: result.data,
                nextCursor: result.nextCursor,
            });
        }

        const result = await searchMedia({
            parsed,
            viewer: req.viewer,
            limit: q.limit,
            cursor: q.cursor,
        });

        return res.json({
            meta: {
                comicMode: false,
                forcedByQuery: false,
                excludedComic: !!parsed.excludeComic,
            },
            data: result.data,
            nextCursor: result.nextCursor,
        });
    } catch (e: any) {
        if (e?.message === 'RATIO_SORT_UNSUPPORTED') {
            return res.status(400).json({
                error: {
                    code: 'BAD_FILTER',
                    message:
                        'ratio filter is only supported with date sorts (new/old) for now',
                },
            });
        }

        throw e;
    }
});
