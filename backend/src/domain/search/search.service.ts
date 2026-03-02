import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { env } from '../../config/env';
import { ModerationStatus } from '@prisma/client';
import type {
    Expr,
    Filter,
    ParseResult,
    SearchSort,
    Term,
} from './search.parser';

import { Permission } from '../auth/permissions';
import type { PrincipalLike } from '../auth/permission.utils';
import { hasPermission } from '../auth/permission.utils';

type Viewer = { id?: string; isAdult: boolean } | undefined;

function canSeeExplicit(principal: PrincipalLike | undefined, viewer: Viewer) {
    if (viewer?.isAdult) return true;
    return hasPermission(principal, Permission.MEDIA_READ_EXPLICIT);
}

function buildMediaVisibilityWhere(
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    const where: any = {};

    // deleted
    if (!hasPermission(principal, Permission.MEDIA_READ_DELETED)) {
        where.deletedAt = null;
    }

    // moderation visibility
    if (!hasPermission(principal, Permission.MEDIA_READ_UNMODERATED)) {
        // guests: only approved
        if (!viewer?.id) {
            where.moderationStatus = ModerationStatus.APPROVED;
        } else {
            // authed user: allow pending/approved, but not rejected
            where.moderationStatus = { not: ModerationStatus.REJECTED };
        }
    }

    // explicit
    if (!canSeeExplicit(principal, viewer)) {
        where.isExplicit = false;
    }

    return where;
}

/**
 * IMPORTANT: keep consistent with getComic(): non-staff can only see own comics
 * New rule:
 * - COMICS_READ_ANY => all visible
 * - else require viewer.id + COMICS_READ_OWN => only own
 * - plus explicit gate (adult or MEDIA_READ_EXPLICIT)
 */
function buildComicVisibilityWhere(
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    const where: any = {};

    const canExplicit = canSeeExplicit(principal, viewer);
    if (!canExplicit) where.isExplicit = false;

    if (hasPermission(principal, Permission.COMICS_READ_ANY)) {
        return where;
    }

    if (!viewer?.id) return { id: '__none__' };

    if (!hasPermission(principal, Permission.COMICS_READ_OWN)) {
        return { id: '__none__' };
    }

    return { ...where, createdById: viewer.id };
}

async function presign(key: string) {
    return minio.presignedGetObject(
        env.MINIO_BUCKET,
        key,
        env.MINIO_PRESIGN_EXPIRES,
    );
}

function tagCondForViewer(
    tagName: string,
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    // minors / no explicit entitlement shouldn't match explicit tags
    if (!canSeeExplicit(principal, viewer)) {
        return { name: tagName, isExplicit: false as const };
    }
    return { name: tagName };
}

// -------------------- filters compilation --------------------

function compileFilterToMediaWhere(f: Filter): any | null {
    if (f.kind === 'type') return { type: f.value };

    if (f.kind === 'uploaded') {
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
        // handled in post-filtering in searchMedia()
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
        ) {
            return { [dbField]: { gte: f.min, lte: f.max } };
        }

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
        ) {
            return { [dbField]: { gte: f.min, lte: f.max } };
        }

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
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    if (term.kind === 'tag') {
        const name = term.name;
        return {
            tagLinks: {
                some: {
                    tag: {
                        ...tagCondForViewer(name, principal, viewer),
                    },
                },
            },
        };
    }

    return compileFilterToMediaWhere(term.filter);
}

function compileTermToComicWhere(
    term: Term,
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    if (term.kind === 'tag') {
        const name = term.name;
        return {
            tagLinks: {
                some: {
                    tag: {
                        ...tagCondForViewer(name, principal, viewer),
                    },
                },
            },
        };
    }

    return compileFilterToComicWhere(term.filter);
}

function compileExprToWhere(
    expr: Expr | null,
    kind: 'media' | 'comic',
    principal: PrincipalLike | undefined,
    viewer: Viewer,
): any {
    if (!expr) return {};

    if (expr.kind === 'term') {
        const w =
            kind === 'media'
                ? compileTermToMediaWhere(expr.term, principal, viewer)
                : compileTermToComicWhere(expr.term, principal, viewer);
        return w ?? {};
    }

    if (expr.kind === 'not') {
        const inner = compileExprToWhere(expr.item, kind, principal, viewer);
        if (!inner || Object.keys(inner).length === 0) return {};
        return { NOT: inner };
    }

    if (expr.kind === 'and') {
        const items = expr.items
            .map((x) => compileExprToWhere(x, kind, principal, viewer))
            .filter((x) => x && Object.keys(x).length > 0);
        if (items.length === 0) return {};
        if (items.length === 1) return items[0];
        return { AND: items };
    }

    if (expr.kind === 'or') {
        const items = expr.items
            .map((x) => compileExprToWhere(x, kind, principal, viewer))
            .filter((x) => x && Object.keys(x).length > 0);
        if (items.length === 0) return {};
        if (items.length === 1) return items[0];
        return { OR: items };
    }

    return {};
}

// -------------------- cursor helpers --------------------

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
    cursorObj: any,
    dir: 'desc' | 'asc',
    valueField: string,
) {
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

// -------------------- ratio post-filter --------------------

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
    height?: number | null,
): boolean {
    if (!width || !height || width <= 0 || height <= 0) return false;
    const r = width / height;

    const okOne = (f: any) => {
        if (f.kind !== 'ratio') return true;

        if (f.op === 'eq' && typeof f.value === 'number')
            return Math.abs(r - f.value) < 1e-6;
        if (
            f.op === 'range' &&
            typeof f.min === 'number' &&
            typeof f.max === 'number'
        ) {
            return r >= f.min && r <= f.max;
        }
        if (f.op === 'gt' && typeof f.value === 'number') return r > f.value;
        if (f.op === 'gte' && typeof f.value === 'number') return r >= f.value;
        if (f.op === 'lt' && typeof f.value === 'number') return r < f.value;
        if (f.op === 'lte' && typeof f.value === 'number') return r <= f.value;

        return true;
    };

    return filters.every(okOne);
}

// -------------------- search: media --------------------

export async function searchMedia(params: {
    parsed: ParseResult;
    viewer: Viewer;
    principal?: PrincipalLike;
    limit: number;
    cursor?: string;
    sort?: SearchSort;
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const sort = params.parsed.sort ?? params.sort ?? 'new';
    const { orderBy, cursorField, dir } = getMediaOrder(sort);

    const whereBase: any = buildMediaVisibilityWhere(
        params.principal,
        params.viewer,
    );

    // -comic => exclude comic pages
    if (params.parsed.excludeComic) {
        whereBase.isComicPage = false;
    }

    // expr (ratio is post-filtered)
    const whereExpr = compileExprToWhere(
        params.parsed.expr,
        'media',
        params.principal,
        params.viewer,
    );

    // cursor
    const cur = decodeCursor(params.cursor);
    let seek: any = null;

    if (cur && cur.mode === 'media' && cur.sort === sort) {
        if (sort === 'random') {
            const start = cur.start;
            const lastV = cur.v;
            const lastId = cur.id;
            if (typeof start === 'number' && lastV !== undefined && lastId) {
                seek = {
                    AND: [
                        { randomKey: { gte: start } },
                        buildSeekWhere(
                            { v: lastV, id: lastId },
                            'asc',
                            'randomKey',
                        ),
                    ],
                };
            }
        } else {
            seek = buildSeekWhere(cur, dir, cursorField);
        }
    }

    // ratio restrictions
    const ratioFilters = extractRatioFilters(params.parsed.expr);
    const needsRatio = ratioFilters.length > 0;

    if (needsRatio && !(sort === 'new' || sort === 'old')) {
        throw new Error('RATIO_SORT_UNSUPPORTED');
    }

    // If random sort and no cursor then generate start key
    let startKey: number | null = null;

    // fetch loop (ratio post-filter)
    const batchSize = needsRatio ? Math.min(300, take * 5) : take + 1;
    const maxIters = needsRatio ? 10 : 1;

    const collected: any[] = [];
    let nextCursor: string | null = null;

    let it = 0;
    let dynamicSeek: any = null;

    while (it < maxIters && collected.length < take + 1) {
        const andParts: any[] = [whereBase, whereExpr];

        // random start key (stable across pagination)
        const effectiveStart = startKey ?? cur?.start;
        if (sort === 'random') {
            if (!cur && startKey === null) startKey = Math.random();
            andParts.push({ randomKey: { gte: effectiveStart ?? startKey! } });
        }

        if (dynamicSeek) andParts.push(dynamicSeek);
        else if (seek) andParts.push(seek);

        const rows = await prisma.media.findMany({
            where: { AND: andParts } as any,
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

        const filtered = needsRatio
            ? rows.filter((m) => matchRatio(ratioFilters, m.width, m.height))
            : rows;

        collected.push(...filtered);

        // advance seek using LAST fetched row (not filtered)
        const last = rows[rows.length - 1] as any;

        if (sort === 'random') {
            dynamicSeek = buildSeekWhere(
                { v: last.randomKey, id: last.id },
                'asc',
                'randomKey',
            );
        } else {
            dynamicSeek = buildSeekWhere(
                { v: last[cursorField], id: last.id },
                dir,
                cursorField,
            );
        }

        it++;
        if (rows.length < batchSize) break;
    }

    const slice = collected.slice(0, take);
    const hasMore = collected.length > take;

    if (hasMore && slice.length > 0) {
        const last = slice[slice.length - 1] as any;

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
                v: last[cursorField],
                id: last.id,
            });
        }
    }

    const canExplicit = canSeeExplicit(params.principal, params.viewer);

    const data = await Promise.all(
        slice.map(async (m: any) => {
            const favorite =
                Array.isArray(m.favorites) && m.favorites.length > 0;
            const myRating =
                Array.isArray(m.ratings) && m.ratings.length > 0
                    ? m.ratings[0].value
                    : null;

            const tags =
                (m.tagLinks ?? [])
                    .filter((l: any) =>
                        canExplicit ? true : !l?.tag?.isExplicit,
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
        }),
    );

    return { mode: 'media' as const, sort, data, nextCursor };
}

// -------------------- search: comics --------------------

export async function searchComics(params: {
    parsed: ParseResult;
    viewer: Viewer;
    principal?: PrincipalLike;
    limit: number;
    cursor?: string;
    sort?: SearchSort;
}) {
    const take = Math.min(Math.max(params.limit, 1), 100);

    const sort = params.parsed.sort ?? params.sort ?? 'last_page';
    const { orderBy, cursorField, dir } = getComicOrder(sort);

    const whereBase: any = buildComicVisibilityWhere(
        params.principal,
        params.viewer,
    );

    const whereExpr = compileExprToWhere(
        params.parsed.expr,
        'comic',
        params.principal,
        params.viewer,
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
                            { v: lastV, id: lastId },
                            'asc',
                            'randomKey',
                        ),
                    ],
                };
            }
        } else if (cursorField === 'lastPageAddedAt') {
            // paginate only when lastPageAddedAt not null
            if (cur.v && cur.id) {
                seek = buildSeekWhere(cur, 'desc', 'lastPageAddedAt');
            }
        } else {
            seek = buildSeekWhere(cur, dir, cursorField);
        }
    }

    let startKey: number | null = null;

    const andParts: any[] = [whereBase, whereExpr];
    if (seek) andParts.push(seek);

    if (sort === 'random' && !cur) {
        startKey = Math.random();
        andParts.push({ randomKey: { gte: startKey } });
    }

    const items = await prisma.comic.findMany({
        where: { AND: andParts } as any,
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
            nextCursor = encodeCursor({
                mode: 'comic',
                sort,
                start: startKey ?? cur?.start ?? null,
                v: last.randomKey,
                id: last.id,
            });
        } else {
            nextCursor = encodeCursor({
                mode: 'comic',
                sort,
                v: last[cursorField],
                id: last.id,
            });
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
        }),
    );

    return { mode: 'comic' as const, sort, data, nextCursor };
}
