import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus, UserRole } from '@prisma/client';
import type {
    Expr,
    Filter,
    ParseResult,
    SearchSort,
    Term,
} from './search.parser';

type Viewer = { id?: string; role: UserRole; isAdult: boolean } | undefined;

function isModerator(viewer: Viewer) {
    return (
        viewer?.role === UserRole.MODERATOR || viewer?.role === UserRole.ADMIN
    );
}

function isGuest(viewer: Viewer) {
    return !viewer || viewer.role === UserRole.GUEST;
}

function buildMediaVisibilityWhere(viewer: Viewer) {
    if (isModerator(viewer)) return {};

    if (isGuest(viewer)) {
        return {
            deletedAt: null,
            moderationStatus: ModerationStatus.APPROVED,
            isExplicit: false,
        };
    }

    const base: any = {
        deletedAt: null,
        moderationStatus: { not: ModerationStatus.REJECTED },
    };

    if (!viewer?.isAdult) {
        base.isExplicit = false;
    }

    return base;
}

function buildComicVisibilityWhere(viewer: Viewer) {
    // IMPORTANT: keep consistent with getComic(): non-mod can only see own comics
    if (isModerator(viewer)) {
        const where: any = {};
        if (!viewer?.isAdult) where.isExplicit = false;
        return where;
    }

    if (!viewer?.id) return { id: '__none__' }; // will return empty

    const where: any = { createdById: viewer.id };
    if (!viewer.isAdult) where.isExplicit = false;
    return where;
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES
    );
}

function tagCondForViewer(tagName: string, viewer: Viewer) {
    // minors shouldn't match explicit tags
    if (!viewer?.isAdult) return { name: tagName, isExplicit: false };
    return { name: tagName };
}

function compileFilterToMediaWhere(f: Filter): any | null {
    if (f.kind === 'type') return { type: f.value };

    if (f.kind === 'uploaded') {
        // Media.createdAt date range
        const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
        if (f.op === 'eq' && f.value) {
            const a = toDate(f.value);
            const b = new Date(a);
            b.setUTCDate(b.getUTCDate() + 1);
            return { createdAt: { gte: a, lt: b } };
        }
        if (f.op === 'range' && f.min && f.max) {
            const a = toDate(f.min);
            const b = toDate(f.max);
            b.setUTCDate(b.getUTCDate() + 1);
            return { createdAt: { gte: a, lt: b } };
        }
        if (
            (f.op === 'gt' ||
                f.op === 'gte' ||
                f.op === 'lt' ||
                f.op === 'lte') &&
            f.value
        ) {
            const d = toDate(f.value);
            const map: any = { gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' };
            return { createdAt: { [map[f.op]]: d } };
        }
        return null;
    }

    if (f.kind === 'ratio') {
        // handled in post-filtering (limited support) in searchMedia()
        return null;
    }

    if (f.kind === 'number') {
        const fieldMap: any = {
            width: 'width',
            height: 'height',
            duration: 'duration',
            size: 'size',
            rating: 'ratingAvg',
            rating_count: 'ratingCount',
            comments: 'commentCount',
        };

        const dbField = fieldMap[f.field];
        if (!dbField) return null;

        if (f.op === 'eq' && typeof f.value === 'number')
            return { [dbField]: f.value };
        if (
            f.op === 'range' &&
            typeof f.min === 'number' &&
            typeof f.max === 'number'
        )
            return { [dbField]: { gte: f.min, lte: f.max } };

        const opMap: any = { gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' };
        if (
            (f.op === 'gt' ||
                f.op === 'gte' ||
                f.op === 'lt' ||
                f.op === 'lte') &&
            typeof f.value === 'number'
        ) {
            return { [dbField]: { [opMap[f.op]]: f.value } };
        }

        return null;
    }

    return null;
}

function compileFilterToComicWhere(f: Filter): any | null {
    if (f.kind === 'type') return null;

    if (f.kind === 'uploaded') {
        // Comic.createdAt
        const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
        if (f.op === 'eq' && f.value) {
            const a = toDate(f.value);
            const b = new Date(a);
            b.setUTCDate(b.getUTCDate() + 1);
            return { createdAt: { gte: a, lt: b } };
        }
        if (f.op === 'range' && f.min && f.max) {
            const a = toDate(f.min);
            const b = toDate(f.max);
            b.setUTCDate(b.getUTCDate() + 1);
            return { createdAt: { gte: a, lt: b } };
        }
        if (
            (f.op === 'gt' ||
                f.op === 'gte' ||
                f.op === 'lt' ||
                f.op === 'lte') &&
            f.value
        ) {
            const d = toDate(f.value);
            const map: any = { gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' };
            return { createdAt: { [map[f.op]]: d } };
        }
        return null;
    }

    if (f.kind === 'ratio') return null;

    if (f.kind === 'number') {
        const fieldMap: any = {
            rating: 'ratingAvg',
            rating_count: 'ratingCount',
        };
        const dbField = fieldMap[f.field];
        if (!dbField) return null;

        if (f.op === 'eq' && typeof f.value === 'number')
            return { [dbField]: f.value };
        if (
            f.op === 'range' &&
            typeof f.min === 'number' &&
            typeof f.max === 'number'
        )
            return { [dbField]: { gte: f.min, lte: f.max } };

        const opMap: any = { gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' };
        if (
            (f.op === 'gt' ||
                f.op === 'gte' ||
                f.op === 'lt' ||
                f.op === 'lte') &&
            typeof f.value === 'number'
        ) {
            return { [dbField]: { [opMap[f.op]]: f.value } };
        }

        return null;
    }

    return null;
}

function compileTermToMediaWhere(
    term: Term,
    viewer: Viewer,
    mode: 'media' | 'comic'
) {
    if (term.kind === 'tag') {
        const name = term.name;

        // comic_page is a normal tag in media mode (unless comicMode on, but that is pruned earlier)
        return {
            tagLinks: {
                some: {
                    tag: {
                        ...tagCondForViewer(name, viewer),
                    },
                },
            },
        };
    }

    // filter
    const w = compileFilterToMediaWhere(term.filter);
    return w;
}

function compileTermToComicWhere(term: Term, viewer: Viewer) {
    if (term.kind === 'tag') {
        const name = term.name;

        return {
            tagLinks: {
                some: {
                    tag: {
                        ...tagCondForViewer(name, viewer),
                    },
                },
            },
        };
    }

    const w = compileFilterToComicWhere(term.filter);
    return w;
}

function compileExprToWhere(
    expr: Expr | null,
    kind: 'media' | 'comic',
    viewer: Viewer
): any {
    if (!expr) return {};

    if (expr.kind === 'term') {
        const w =
            kind === 'media'
                ? compileTermToMediaWhere(expr.term, viewer, 'media')
                : compileTermToComicWhere(expr.term, viewer);

        return w ?? {};
    }

    if (expr.kind === 'not') {
        const inner = compileExprToWhere(expr.item, kind, viewer);
        if (!inner || Object.keys(inner).length === 0) return {};
        return { NOT: inner };
    }

    if (expr.kind === 'and') {
        const items = expr.items
            .map((x) => compileExprToWhere(x, kind, viewer))
            .filter((x) => x && Object.keys(x).length > 0);
        if (items.length === 0) return {};
        if (items.length === 1) return items[0];
        return { AND: items };
    }

    if (expr.kind === 'or') {
        const items = expr.items
            .map((x) => compileExprToWhere(x, kind, viewer))
            .filter((x) => x && Object.keys(x).length > 0);
        if (items.length === 0) return {};
        if (items.length === 1) return items[0];
        return { OR: items };
    }

    return {};
}

function encodeCursor(obj: any) {
    return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): any | null {
    if (!cursor) return null;
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function buildSeekWhere(
    sort: SearchSort,
    cursorObj: any,
    dir: 'desc' | 'asc',
    valueField: string
) {
    // (value < last) OR (value = last AND id < lastId)  for desc
    // (value > last) OR (value = last AND id > lastId)  for asc
    const lastValue = cursorObj?.v;
    const lastId = cursorObj?.id;
    if (lastValue === undefined || !lastId) return null;

    if (dir === 'desc') {
        return {
            OR: [
                { [valueField]: { lt: lastValue } },
                { AND: [{ [valueField]: lastValue }, { id: { lt: lastId } }] },
            ],
        };
    }

    return {
        OR: [
            { [valueField]: { gt: lastValue } },
            { AND: [{ [valueField]: lastValue }, { id: { gt: lastId } }] },
        ],
    };
}

function getMediaOrder(sort: SearchSort) {
    switch (sort) {
        case 'old':
            return {
                orderBy: [
                    { createdAt: 'asc' as const },
                    { id: 'asc' as const },
                ],
                cursorField: 'createdAt',
                dir: 'asc' as const,
            };
        case 'updated':
            return {
                orderBy: [
                    { updatedAt: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'updatedAt',
                dir: 'desc' as const,
            };
        case 'rating':
            return {
                orderBy: [
                    { ratingAvg: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'ratingAvg',
                dir: 'desc' as const,
            };
        case 'rating_count':
            return {
                orderBy: [
                    { ratingCount: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'ratingCount',
                dir: 'desc' as const,
            };
        case 'random':
            return {
                orderBy: [
                    { randomKey: 'asc' as const },
                    { id: 'asc' as const },
                ],
                cursorField: 'randomKey',
                dir: 'asc' as const,
            };
        case 'new':
        default:
            return {
                orderBy: [
                    { createdAt: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'createdAt',
                dir: 'desc' as const,
            };
    }
}

function getComicOrder(sort: SearchSort) {
    switch (sort) {
        case 'new':
            return {
                orderBy: [
                    { createdAt: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'createdAt',
                dir: 'desc' as const,
            };
        case 'rating':
            return {
                orderBy: [
                    { ratingAvg: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'ratingAvg',
                dir: 'desc' as const,
            };
        case 'rating_count':
            return {
                orderBy: [
                    { ratingCount: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'ratingCount',
                dir: 'desc' as const,
            };
        case 'random':
            return {
                orderBy: [
                    { randomKey: 'asc' as const },
                    { id: 'asc' as const },
                ],
                cursorField: 'randomKey',
                dir: 'asc' as const,
            };
        case 'updated':
            return {
                orderBy: [
                    { updatedAt: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'updatedAt',
                dir: 'desc' as const,
            };
        case 'last_page':
        default:
            return {
                orderBy: [
                    { lastPageAddedAt: 'desc' as const },
                    { id: 'desc' as const },
                ],
                cursorField: 'lastPageAddedAt',
                dir: 'desc' as const,
            };
    }
}

function hasRatio(expr: Expr | null): boolean {
    if (!expr) return false;
    if (expr.kind === 'term')
        return expr.term.kind === 'filter' && expr.term.filter.kind === 'ratio';
    if (expr.kind === 'not') return hasRatio(expr.item);
    if (expr.kind === 'and' || expr.kind === 'or')
        return expr.items.some(hasRatio);
    return false;
}

function extractRatioFilters(expr: Expr | null): Filter[] {
    const out: Filter[] = [];
    const walk = (e: Expr | null) => {
        if (!e) return;
        if (
            e.kind === 'term' &&
            e.term.kind === 'filter' &&
            e.term.filter.kind === 'ratio'
        ) {
            out.push(e.term.filter);
            return;
        }
        if (e.kind === 'not') walk(e.item);
        if (e.kind === 'and' || e.kind === 'or') e.items.forEach(walk);
    };
    walk(expr);
    return out;
}

function matchRatio(
    filters: Filter[],
    width?: number | null,
    height?: number | null
): boolean {
    if (!width || !height || width <= 0 || height <= 0) return false;
    const r = width / height;

    const okOne = (f: any) => {
        if (f.kind !== 'ratio') return true;
        const op = f.op;
        if (op === 'eq' && typeof f.value === 'number')
            return Math.abs(r - f.value) < 1e-6;
        if (
            op === 'range' &&
            typeof f.min === 'number' &&
            typeof f.max === 'number'
        )
            return r >= f.min && r <= f.max;
        if (op === 'gt' && typeof f.value === 'number') return r > f.value;
        if (op === 'gte' && typeof f.value === 'number') return r >= f.value;
        if (op === 'lt' && typeof f.value === 'number') return r < f.value;
        if (op === 'lte' && typeof f.value === 'number') return r <= f.value;
        return true;
    };

    // AND semantics for ratio filters
    return filters.every(okOne);
}

export async function searchMedia(params: {
    parsed: ParseResult;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort?: SearchSort;
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const sort = params.parsed.sort ?? params.sort ?? 'new';
    const { orderBy, cursorField, dir } = getMediaOrder(sort);

    // base where
    const whereBase: any = {
        ...buildMediaVisibilityWhere(params.viewer),
    };

    // -comic => exclude comic pages
    if (params.parsed.excludeComic) {
        whereBase.isComicPage = false;
    }

    // compile expression (note: ratio is post-filtered)
    const whereExpr = compileExprToWhere(
        params.parsed.expr,
        'media',
        params.viewer
    );

    // seek cursor
    const cur = decodeCursor(params.cursor);
    let seek: any = null;

    if (cur && cur.mode === 'media' && cur.sort === sort) {
        // random special, also keep start key
        if (sort === 'random') {
            const start = cur.start;
            const lastV = cur.v;
            const lastId = cur.id;
            if (typeof start === 'number') {
                if (lastV === undefined || !lastId) {
                    // if first page continuation not possible then ignore
                } else {
                    seek = {
                        AND: [
                            { randomKey: { gte: start } },
                            buildSeekWhere(
                                'random',
                                { v: lastV, id: lastId },
                                'asc',
                                'randomKey'
                            ),
                        ],
                    };
                }
            }
        } else {
            seek = buildSeekWhere(sort, cur, dir, cursorField);
        }
    }

    // ratio support only for date-based sorts (new/old) to avoid crazy semantics
    const ratioFilters = extractRatioFilters(params.parsed.expr);
    const needsRatio = ratioFilters.length > 0;

    if (needsRatio && !(sort === 'new' || sort === 'old')) {
        throw new Error('RATIO_SORT_UNSUPPORTED');
    }

    const finalWhere = {
        AND: [whereBase, whereExpr, ...(seek ? [seek] : [])],
    };

    // If random sort and no cursor then generate start key
    let startKey: number | null = null;
    if (sort === 'random' && !cur) {
        startKey = Math.random();
        (finalWhere.AND as any[]).push({ randomKey: { gte: startKey } });
    }

    // fetch loop if ratio post-filtering needed
    const batchSize = needsRatio ? Math.min(300, take * 5) : take + 1;
    const maxIters = needsRatio ? 10 : 1;

    const collected: any[] = [];
    let nextCursor: string | null = null;
    let localCursorObj: any = null;

    let it = 0;
    let dynamicSeek: any = null;

    while (it < maxIters && collected.length < take + 1) {
        const whereIter = {
            AND: [
                whereBase,
                whereExpr,
                ...(sort === 'random' && (startKey ?? cur?.start) !== undefined
                    ? [{ randomKey: { gte: startKey ?? cur?.start } }]
                    : []),
                ...(dynamicSeek ? [dynamicSeek] : seek ? [seek] : []),
            ],
        };

        const rows = await prisma.media.findMany({
            where: whereIter as any,
            orderBy: orderBy as any,
            take: batchSize,
            include: {
                tagLinks: {
                    include: { tag: { include: { category: true } } },
                    orderBy: { addedAt: 'asc' },
                },
                favorites: params.viewer?.id
                    ? {
                          where: { userId: params.viewer.id },
                          select: { id: true },
                          take: 1,
                      }
                    : false,
                ratings: params.viewer?.id
                    ? {
                          where: { userId: params.viewer.id },
                          select: { value: true },
                          take: 1,
                      }
                    : false,
            },
        });

        if (rows.length === 0) break;

        // ratio post-filter
        const filtered = needsRatio
            ? rows.filter((m) => matchRatio(ratioFilters, m.width, m.height))
            : rows;

        collected.push(...filtered);

        // advance seek cursor by last row in rows to avoid infinite loop
        const last = rows[rows.length - 1];

        if (sort === 'random') {
            dynamicSeek = buildSeekWhere(
                'random',
                { v: last.randomKey, id: last.id },
                'asc',
                'randomKey'
            );
        } else {
            dynamicSeek = buildSeekWhere(
                sort,
                { v: (last as any)[cursorField], id: last.id },
                dir,
                cursorField
            );
        }

        localCursorObj = {
            mode: 'media',
            sort,
            ...(sort === 'random'
                ? { start: startKey ?? cur?.start ?? null }
                : {}),
            v: sort === 'random' ? last.randomKey : (last as any)[cursorField],
            id: last.id,
        };

        it++;
        // stop if clearly exhausted
        if (rows.length < batchSize) break;
    }

    const slice = collected.slice(0, take);
    const hasMore = collected.length > take;

    // build cursor from last item returned (not from last fetched)
    if (hasMore) {
        const last = slice[slice.length - 1];
        if (sort === 'random') {
            nextCursor = encodeCursor({
                mode: 'media',
                sort,
                start: startKey ?? cur?.start ?? null,
                v: last.randomKey,
                id: last.id,
            });
        } else {
            nextCursor = encodeCursor({
                mode: 'media',
                sort,
                v: (last as any)[cursorField],
                id: last.id,
            });
        }
    }

    // map dto + presign preview
    const data = await Promise.all(
        slice.map(async (m) => {
            const favorite =
                Array.isArray(m.favorites) && m.favorites.length > 0;
            const myRating =
                Array.isArray(m.ratings) && m.ratings.length > 0
                    ? m.ratings[0].value
                    : null;

            const tags =
                (m.tagLinks ?? [])
                    .filter((l: any) =>
                        params.viewer?.isAdult ? true : !l?.tag?.isExplicit
                    )
                    .map((l: any) => ({
                        id: l.tag.id,
                        name: l.tag.name,
                        usageCount: l.tag.usageCount,
                        categoryId: l.tag.category.id,
                        categoryName: l.tag.category.name,
                        color: l.tag.customColor ?? l.tag.category.color,
                        customColor: l.tag.customColor,
                        addedAt: l.addedAt,
                    })) ?? [];

            return {
                id: m.id,
                hash: m.hash,
                type: m.type,
                contentType: m.contentType,
                size: m.size,
                width: m.width,
                height: m.height,
                duration: m.duration,
                description: m.description,
                isExplicit: m.isExplicit,
                ratingAvg: m.ratingAvg ?? 0,
                ratingCount: m.ratingCount ?? 0,
                myRating,
                commentCount: m.commentCount ?? 0,
                originalKey: m.originalKey,
                previewKey: m.previewKey,
                moderationStatus: m.moderationStatus,
                moderatedAt: m.moderatedAt,
                moderatedById: m.moderatedById,
                moderationNotes: m.moderationNotes,
                uploadedById: m.uploadedById,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
                deletedAt: m.deletedAt,
                deletedBy: m.deletedBy,
                tags,
                favorite,
                previewUrl: m.previewKey ? await presign(m.previewKey) : null,
            };
        })
    );

    return {
        mode: 'media' as const,
        sort,
        data,
        nextCursor,
    };
}

export async function searchComics(params: {
    parsed: ParseResult;
    viewer: Viewer;
    limit: number;
    cursor?: string;
    sort?: SearchSort;
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const sort = params.parsed.sort ?? params.sort ?? 'last_page';
    const { orderBy, cursorField, dir } = getComicOrder(sort);

    const whereBase: any = buildComicVisibilityWhere(params.viewer);

    const whereExpr = compileExprToWhere(
        params.parsed.expr,
        'comic',
        params.viewer
    );

    const cur = decodeCursor(params.cursor);
    let seek: any = null;

    if (cur && cur.mode === 'comic' && cur.sort === sort) {
        if (sort === 'random') {
            const start = cur.start;
            const lastV = cur.v;
            const lastId = cur.id;
            if (typeof start === 'number' && lastV !== undefined && lastId) {
                seek = {
                    AND: [
                        { randomKey: { gte: start } },
                        buildSeekWhere(
                            'random',
                            { v: lastV, id: lastId },
                            'asc',
                            'randomKey'
                        ),
                    ],
                };
            }
        } else if (cursorField === 'lastPageAddedAt') {
            // only paginate when lastPageAddedAt not null
            if (cur.v && cur.id) {
                seek = buildSeekWhere(
                    'last_page',
                    cur,
                    'desc',
                    'lastPageAddedAt'
                );
            }
        } else {
            seek = buildSeekWhere(sort, cur, dir, cursorField);
        }
    }

    let startKey: number | null = null;
    const baseAnd: any[] = [whereBase, whereExpr];
    if (seek) baseAnd.push(seek);

    if (sort === 'random' && !cur) {
        startKey = Math.random();
        baseAnd.push({ randomKey: { gte: startKey } });
    }

    const items = await prisma.comic.findMany({
        where: { AND: baseAnd } as any,
        orderBy: orderBy as any,
        take: take + 1,
        include: {
            coverMedia: { select: { id: true, previewKey: true } },
            lastPageMedia: { select: { id: true, previewKey: true } },
        },
    });

    const next = items.length > take ? items[take] : null;
    const slice = items.slice(0, take);

    let nextCursor: string | null = null;
    if (next && slice.length > 0) {
        const last = slice[slice.length - 1] as any;
        if (sort === 'random') {
            nextCursor = Buffer.from(
                JSON.stringify({
                    mode: 'comic',
                    sort,
                    start: startKey ?? cur?.start ?? null,
                    v: last.randomKey,
                    id: last.id,
                }),
                'utf8'
            ).toString('base64url');
        } else {
            nextCursor = Buffer.from(
                JSON.stringify({
                    mode: 'comic',
                    sort,
                    v: last[cursorField],
                    id: last.id,
                }),
                'utf8'
            ).toString('base64url');
        }
    }

    const data = await Promise.all(
        slice.map(async (c: any) => {
            const previewKey =
                c.lastPageMedia?.previewKey ?? c.coverMedia?.previewKey ?? null;
            const previewUrl = previewKey ? await presign(previewKey) : null;

            return {
                id: c.id,
                title: c.title,
                status: c.status,
                createdById: c.createdById,
                coverMediaId: c.coverMediaId,
                lastPageAddedAt: c.lastPageAddedAt,
                lastPageMediaId: c.lastPageMediaId,
                randomKey: c.randomKey,
                isExplicit: c.isExplicit,
                ratingAvg: c.ratingAvg ?? 0,
                ratingCount: c.ratingCount ?? 0,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                previewUrl,
            };
        })
    );

    return {
        mode: 'comic' as const,
        sort,
        data,
        nextCursor,
    };
}
