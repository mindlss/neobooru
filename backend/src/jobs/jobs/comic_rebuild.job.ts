// src/jobs/jobs/comic_rebuild.job.ts
import type { Job } from '../types';
import { prisma } from '../../lib/prisma';

const COMIC_PAGE_TAG = 'comic_page';
const GENERAL_CATEGORY = 'general';

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function computeAvg(sum: number, count: number) {
    if (count <= 0) return 0;
    return sum / count;
}

async function getOrCreateGeneralCategoryId(tx: any) {
    const cat = await tx.tagCategory.findUnique({
        where: { name: GENERAL_CATEGORY },
        select: { id: true },
    });
    if (cat) return cat.id;

    const created = await tx.tagCategory.create({
        data: { name: GENERAL_CATEGORY, color: '#3B82F6' },
        select: { id: true },
    });
    return created.id;
}

async function getOrCreateComicPageTagId(tx: any) {
    const name = normalizeTagName(COMIC_PAGE_TAG);

    const existing = await tx.tag.findUnique({
        where: { name },
        select: { id: true },
    });
    if (existing) return existing.id;

    const generalId = await getOrCreateGeneralCategoryId(tx);

    const created = await tx.tag.create({
        data: { name, categoryId: generalId },
        select: { id: true },
    });
    return created.id;
}

export const comicRebuildJob: Job = {
    name: 'comic_rebuild',
    description:
        'Rebuild ComicTags, Comic aggregates (explicit/rating/last page), and Media.isComicPage + comic_page tag',
    everyMs: 6 * 60 * 60_000,
    runOnStart: false,

    async run({ now }) {
        const stats: Record<string, number> = {
            comics: 0,
            pages: 0,
            mediaMarkedComicPage: 0,
            mediaUnmarkedComicPage: 0,
            mediaTagAdded: 0,
            mediaTagRemoved: 0,
            comicTagsRowsInserted: 0,
            comicTagsRowsDeleted: 0,
            comicsUpdated: 0,
        };

        await prisma.$transaction(async (tx) => {
            const comicPageTagId = await getOrCreateComicPageTagId(tx);

            // ===== Media.isComicPage rebuild =====
            const pageMediaRows = await tx.comicPage.findMany({
                select: { mediaId: true },
            });

            const pageMediaIds = Array.from(
                new Set(pageMediaRows.map((r: any) => r.mediaId))
            );
            stats.pages = pageMediaRows.length;

            if (pageMediaIds.length > 0) {
                const resTrue = await tx.media.updateMany({
                    where: { id: { in: pageMediaIds } },
                    data: { isComicPage: true },
                });
                stats.mediaMarkedComicPage = resTrue.count;
            }

            const resFalse = await tx.media.updateMany({
                where: { isComicPage: true, id: { notIn: pageMediaIds } },
                data: { isComicPage: false },
            });
            stats.mediaUnmarkedComicPage = resFalse.count;

            // ===== comic_page tag on MediaTags =====
            if (pageMediaIds.length > 0) {
                const existingLinks = await tx.mediaTags.findMany({
                    where: {
                        mediaId: { in: pageMediaIds },
                        tagId: comicPageTagId,
                    },
                    select: { mediaId: true },
                });
                const hasTag = new Set(
                    existingLinks.map((l: any) => l.mediaId)
                );
                const toAdd = pageMediaIds.filter((id) => !hasTag.has(id));

                if (toAdd.length > 0) {
                    const createRes = await tx.mediaTags.createMany({
                        data: toAdd.map((mediaId) => ({
                            mediaId,
                            tagId: comicPageTagId,
                        })),
                        skipDuplicates: true,
                    });
                    stats.mediaTagAdded += createRes.count;

                    await tx.tag.update({
                        where: { id: comicPageTagId },
                        data: { usageCount: { increment: createRes.count } },
                    });
                }
            }

            // remove comic_page tag from medias that are no longer pages
            const tagLinks = await tx.mediaTags.findMany({
                where: { tagId: comicPageTagId },
                select: { mediaId: true },
            });
            const taggedMediaIds = Array.from(
                new Set(tagLinks.map((l: any) => l.mediaId))
            );

            const pageSet = new Set(pageMediaIds);
            const toRemove = taggedMediaIds.filter((id) => !pageSet.has(id));

            if (toRemove.length > 0) {
                const delRes = await tx.mediaTags.deleteMany({
                    where: { tagId: comicPageTagId, mediaId: { in: toRemove } },
                });
                stats.mediaTagRemoved += delRes.count;

                await tx.tag.update({
                    where: { id: comicPageTagId },
                    data: { usageCount: { decrement: delRes.count } },
                });
            }

            // ===== ComicTags rebuild (materialized union) =====
            const delComicTags = await tx.comicTags.deleteMany({});
            stats.comicTagsRowsDeleted = delComicTags.count;

            const rows = await tx.comicPage.findMany({
                select: {
                    comicId: true,
                    media: {
                        select: {
                            tagLinks: { select: { tagId: true } },
                        },
                    },
                },
            });

            const pairSet = new Set<string>();
            for (const r of rows) {
                const comicId = r.comicId as string;
                const tagIds = (r.media.tagLinks as any[])
                    .map((l) => l.tagId as string)
                    .filter((id) => id !== comicPageTagId);

                for (const tagId of tagIds) {
                    pairSet.add(`${comicId}:${tagId}`);
                }
            }

            const pairs = Array.from(pairSet).map((k) => {
                const [comicId, tagId] = k.split(':');
                return { comicId, tagId };
            });

            if (pairs.length > 0) {
                const ins = await tx.comicTags.createMany({
                    data: pairs,
                    skipDuplicates: true,
                });
                stats.comicTagsRowsInserted = ins.count;
            }

            // ===== isExplicit + rating + last page =====
            const comics = await tx.comic.findMany({
                select: { id: true },
            });
            stats.comics = comics.length;

            for (const c of comics) {
                const pages = await tx.comicPage.findMany({
                    where: { comicId: c.id },
                    orderBy: { position: 'asc' },
                    select: {
                        mediaId: true,
                        position: true,
                        addedAt: true,
                        media: {
                            select: {
                                isExplicit: true,
                                ratingSum: true,
                                ratingCount: true,
                            },
                        },
                    },
                });

                if (pages.length === 0) {
                    await tx.comic.update({
                        where: { id: c.id },
                        data: {
                            isExplicit: false,
                            ratingSum: 0,
                            ratingCount: 0,
                            ratingAvg: 0,
                            lastPageMediaId: null,
                            lastPageAddedAt: null,
                        },
                    });
                    stats.comicsUpdated += 1;
                    continue;
                }

                let isExplicit = false;
                let ratingSum = 0;
                let ratingCount = 0;

                for (const p of pages) {
                    if (p.media.isExplicit) isExplicit = true;
                    ratingSum += p.media.ratingSum;
                    ratingCount += p.media.ratingCount;
                }

                const ratingAvg = computeAvg(ratingSum, ratingCount);

                const lastPage = pages[pages.length - 1];
                const lastPageMediaId = lastPage.mediaId;

                // recovery strategy for lastPageAddedAt
                let maxAddedAt = pages[0].addedAt;
                for (const p of pages) {
                    if (p.addedAt > maxAddedAt) maxAddedAt = p.addedAt;
                }

                await tx.comic.update({
                    where: { id: c.id },
                    data: {
                        isExplicit,
                        ratingSum,
                        ratingCount,
                        ratingAvg,
                        lastPageMediaId,
                        lastPageAddedAt: maxAddedAt,
                    },
                });
                stats.comicsUpdated += 1;
            }
        });

        return {
            ok: true,
            stats: {
                ...stats,
                ranAtUnix: Math.floor(now.getTime() / 1000),
            },
        };
    },
};
