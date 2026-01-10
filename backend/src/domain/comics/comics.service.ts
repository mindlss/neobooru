import { prisma } from '../../lib/prisma';
import { Prisma, UserRole, ComicStatus } from '@prisma/client';

type Viewer = { id: string; role: UserRole };

const COMIC_PAGE_TAG = 'comic_page';
const GENERAL_CATEGORY = 'general';

function isModerator(viewer: Viewer) {
    return viewer.role === UserRole.MODERATOR || viewer.role === UserRole.ADMIN;
}

function assertCanEditComic(viewer: Viewer, comic: { createdById: string }) {
    if (isModerator(viewer)) return;
    if (comic.createdById !== viewer.id) throw new Error('FORBIDDEN');
}

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

async function assertCanUseMedia(
    tx: Prisma.TransactionClient,
    viewer: Viewer,
    mediaId: string
) {
    if (isModerator(viewer)) return;

    const m = await tx.media.findUnique({
        where: { id: mediaId },
        select: { id: true, uploadedById: true, deletedAt: true },
    });

    if (!m || m.deletedAt) throw new Error('MEDIA_NOT_FOUND');
    if (m.uploadedById !== viewer.id) throw new Error('FORBIDDEN_MEDIA');
}

async function getSystemTagId(tx: Prisma.TransactionClient, name: string) {
    const n = normalizeTagName(name);

    const general = await tx.tagCategory.findUnique({
        where: { name: GENERAL_CATEGORY },
        select: { id: true },
    });
    if (!general) throw new Error('GENERAL_CATEGORY_MISSING');

    const existing = await tx.tag.findUnique({
        where: { name: n },
        select: { id: true },
    });

    if (existing) return existing.id;

    const created = await tx.tag.create({
        data: { name: n, categoryId: general.id },
        select: { id: true },
    });

    return created.id;
}

async function ensureMediaHasTag(
    tx: Prisma.TransactionClient,
    mediaId: string,
    tagId: string
) {
    const exists = await tx.mediaTags.findUnique({
        where: { mediaId_tagId: { mediaId, tagId } },
        select: { mediaId: true },
    });

    if (exists) return;

    await tx.mediaTags.create({ data: { mediaId, tagId } });
    await tx.tag.update({
        where: { id: tagId },
        data: { usageCount: { increment: 1 } },
    });
}

async function removeMediaTagIfPresent(
    tx: Prisma.TransactionClient,
    mediaId: string,
    tagId: string
) {
    const exists = await tx.mediaTags.findUnique({
        where: { mediaId_tagId: { mediaId, tagId } },
        select: { mediaId: true },
    });

    if (!exists) return;

    await tx.mediaTags.delete({ where: { mediaId_tagId: { mediaId, tagId } } });
    await tx.tag.update({
        where: { id: tagId },
        data: { usageCount: { decrement: 1 } },
    });
}

async function recomputeMediaComicFlagAndTag(
    tx: Prisma.TransactionClient,
    mediaId: string
) {
    const cnt = await tx.comicPage.count({ where: { mediaId } });
    const isComicPage = cnt > 0;

    await tx.media.update({
        where: { id: mediaId },
        data: { isComicPage },
    });

    const comicPageTagId = await getSystemTagId(tx, COMIC_PAGE_TAG);

    if (isComicPage) {
        await ensureMediaHasTag(tx, mediaId, comicPageTagId);
    } else {
        await removeMediaTagIfPresent(tx, mediaId, comicPageTagId);
    }
}

async function recomputeLastPageMediaId(
    tx: Prisma.TransactionClient,
    comicId: string
) {
    const last = await tx.comicPage.findFirst({
        where: { comicId },
        orderBy: { position: 'desc' },
        select: { mediaId: true },
    });

    await tx.comic.update({
        where: { id: comicId },
        data: { lastPageMediaId: last?.mediaId ?? null },
    });
}

function computeAvg(sum: number, count: number) {
    if (count <= 0) return 0;
    return sum / count;
}

async function addPageTagsToComicTags(
    tx: Prisma.TransactionClient,
    comicId: string,
    mediaId: string
) {
    const comicPageTagId = await getSystemTagId(tx, COMIC_PAGE_TAG);

    const links = await tx.mediaTags.findMany({
        where: { mediaId },
        select: { tagId: true },
    });

    const tagIds = Array.from(
        new Set(links.map((l) => l.tagId).filter((id) => id !== comicPageTagId))
    );

    if (tagIds.length === 0) return;

    await tx.comicTags.createMany({
        data: tagIds.map((tagId) => ({ comicId, tagId })),
        skipDuplicates: true,
    });
}

async function maybeRemovePageTagsFromComicTags(
    tx: Prisma.TransactionClient,
    comicId: string,
    removedMediaId: string
) {
    const comicPageTagId = await getSystemTagId(tx, COMIC_PAGE_TAG);

    const removedLinks = await tx.mediaTags.findMany({
        where: { mediaId: removedMediaId },
        select: { tagId: true },
    });

    const candidateTagIds = Array.from(
        new Set(
            removedLinks
                .map((l) => l.tagId)
                .filter((id) => id !== comicPageTagId)
        )
    );

    if (candidateTagIds.length === 0) return;

    const still = await tx.mediaTags.findMany({
        where: {
            tagId: { in: candidateTagIds },
            media: {
                comics: { some: { comicId } },
            },
        },
        distinct: ['tagId'],
        select: { tagId: true },
    });

    const stillSet = new Set(still.map((s) => s.tagId));
    const toDelete = candidateTagIds.filter((id) => !stillSet.has(id));

    if (toDelete.length === 0) return;

    await tx.comicTags.deleteMany({
        where: { comicId, tagId: { in: toDelete } },
    });
}

async function recomputeComicExplicitIfNeeded(
    tx: Prisma.TransactionClient,
    comicId: string
) {
    const cnt = await tx.comicPage.count({
        where: { comicId, media: { isExplicit: true } },
    });

    await tx.comic.update({
        where: { id: comicId },
        data: { isExplicit: cnt > 0 },
    });
}

export async function createComic(input: { title: string; viewer: Viewer }) {
    const title = input.title.trim();
    if (!title) throw new Error('TITLE_INVALID');

    return prisma.comic.create({
        data: {
            title,
            createdById: input.viewer.id,
        },
        select: {
            id: true,
            title: true,
            status: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

export async function updateComic(input: {
    comicId: string;
    viewer: Viewer;
    title?: string;
    status?: ComicStatus;
    coverMediaId?: string | null;
}) {
    return prisma.$transaction(async (tx) => {
        const comic = await tx.comic.findUnique({
            where: { id: input.comicId },
            select: { id: true, createdById: true },
        });
        if (!comic) throw new Error('NOT_FOUND');
        assertCanEditComic(input.viewer, comic);

        if (input.coverMediaId !== undefined && input.coverMediaId !== null) {
            await assertCanUseMedia(tx, input.viewer, input.coverMediaId);
        }

        return tx.comic.update({
            where: { id: input.comicId },
            data: {
                ...(input.title !== undefined
                    ? { title: input.title.trim() }
                    : {}),
                ...(input.status !== undefined ? { status: input.status } : {}),
                ...(input.coverMediaId !== undefined
                    ? { coverMediaId: input.coverMediaId }
                    : {}),
            },
            select: {
                id: true,
                title: true,
                status: true,
                coverMediaId: true,
                updatedAt: true,
            },
        });
    });
}

export async function addComicPage(input: {
    comicId: string;
    mediaId: string;
    viewer: Viewer;
    position?: number;
}) {
    return prisma.$transaction(async (tx) => {
        const now = new Date();

        const comic = await tx.comic.findUnique({
            where: { id: input.comicId },
            select: {
                id: true,
                createdById: true,
                ratingSum: true,
                ratingCount: true,
                isExplicit: true,
                lastPageAddedAt: true,
            },
        });
        if (!comic) throw new Error('NOT_FOUND');
        assertCanEditComic(input.viewer, comic);

        await assertCanUseMedia(tx, input.viewer, input.mediaId);

        const already = await tx.comicPage.findUnique({
            where: {
                comicId_mediaId: {
                    comicId: input.comicId,
                    mediaId: input.mediaId,
                },
            },
            select: { id: true },
        });
        if (already) throw new Error('ALREADY_IN_COMIC');

        const pagesCount = await tx.comicPage.count({
            where: { comicId: input.comicId },
        });
        const desiredPosRaw = input.position ?? pagesCount + 1;
        const desiredPos = Math.max(1, Math.min(desiredPosRaw, pagesCount + 1));

        await tx.comicPage.updateMany({
            where: { comicId: input.comicId, position: { gte: desiredPos } },
            data: { position: { increment: 1 } },
        });

        const page = await tx.comicPage.create({
            data: {
                comicId: input.comicId,
                mediaId: input.mediaId,
                position: desiredPos,
                addedAt: now,
            },
            select: {
                id: true,
                comicId: true,
                mediaId: true,
                position: true,
                addedAt: true,
            },
        });

        await recomputeMediaComicFlagAndTag(tx, input.mediaId);

        await addPageTagsToComicTags(tx, input.comicId, input.mediaId);

        const m = await tx.media.findUnique({
            where: { id: input.mediaId },
            select: { ratingSum: true, ratingCount: true, isExplicit: true },
        });
        if (!m) throw new Error('MEDIA_NOT_FOUND');

        const newSum = comic.ratingSum + m.ratingSum;
        const newCount = comic.ratingCount + m.ratingCount;
        const newAvg = computeAvg(newSum, newCount);

        await tx.comic.update({
            where: { id: input.comicId },
            data: {
                ratingSum: newSum,
                ratingCount: newCount,
                ratingAvg: newAvg,
                lastPageAddedAt: now,
                ...(comic.isExplicit
                    ? {}
                    : m.isExplicit
                    ? { isExplicit: true }
                    : {}),
            },
        });

        await recomputeLastPageMediaId(tx, input.comicId);

        return page;
    });
}

export async function removeComicPage(input: {
    comicId: string;
    mediaId: string;
    viewer: Viewer;
}) {
    return prisma.$transaction(async (tx) => {
        const comic = await tx.comic.findUnique({
            where: { id: input.comicId },
            select: {
                id: true,
                createdById: true,
                ratingSum: true,
                ratingCount: true,
                isExplicit: true,
                lastPageAddedAt: true,
            },
        });
        if (!comic) throw new Error('NOT_FOUND');
        assertCanEditComic(input.viewer, comic);

        const page = await tx.comicPage.findUnique({
            where: {
                comicId_mediaId: {
                    comicId: input.comicId,
                    mediaId: input.mediaId,
                },
            },
            select: { id: true, position: true },
        });

        if (!page) return { ok: true };

        const m = await tx.media.findUnique({
            where: { id: input.mediaId },
            select: { ratingSum: true, ratingCount: true, isExplicit: true },
        });
        if (!m) throw new Error('MEDIA_NOT_FOUND');

        await tx.comicPage.delete({ where: { id: page.id } });

        await tx.comicPage.updateMany({
            where: { comicId: input.comicId, position: { gt: page.position } },
            data: { position: { decrement: 1 } },
        });

        await maybeRemovePageTagsFromComicTags(
            tx,
            input.comicId,
            input.mediaId
        );

        const newSum = comic.ratingSum - m.ratingSum;
        const newCount = Math.max(0, comic.ratingCount - m.ratingCount);
        const newAvg = computeAvg(newSum, newCount);

        const remainingPages = await tx.comicPage.count({
            where: { comicId: input.comicId },
        });

        await tx.comic.update({
            where: { id: input.comicId },
            data: {
                ratingSum: newSum,
                ratingCount: newCount,
                ratingAvg: newAvg,
                ...(remainingPages === 0
                    ? { lastPageAddedAt: null, lastPageMediaId: null }
                    : {}),
            },
        });

        if (comic.isExplicit && m.isExplicit) {
            await recomputeComicExplicitIfNeeded(tx, input.comicId);
        }

        if (remainingPages > 0) {
            await recomputeLastPageMediaId(tx, input.comicId);
        }

        await recomputeMediaComicFlagAndTag(tx, input.mediaId);

        return { ok: true };
    });
}

export async function reorderComicPages(input: {
    comicId: string;
    orderedMediaIds: string[];
    viewer: Viewer;
}) {
    return prisma.$transaction(async (tx) => {
        const comic = await tx.comic.findUnique({
            where: { id: input.comicId },
            select: { id: true, createdById: true },
        });
        if (!comic) throw new Error('NOT_FOUND');
        assertCanEditComic(input.viewer, comic);

        const pages = await tx.comicPage.findMany({
            where: { comicId: input.comicId },
            orderBy: { position: 'asc' },
            select: { mediaId: true },
        });

        const existing = pages.map((p) => p.mediaId);
        const existingSet = new Set(existing);

        const ordered = input.orderedMediaIds;
        if (ordered.length !== existing.length)
            throw new Error('BAD_ORDER_LENGTH');

        const seen = new Set<string>();
        for (const id of ordered) {
            if (!existingSet.has(id)) throw new Error('BAD_ORDER_MEDIA');
            if (seen.has(id)) throw new Error('BAD_ORDER_DUP');
            seen.add(id);
        }

        const OFFSET = 100000;

        await tx.comicPage.updateMany({
            where: { comicId: input.comicId },
            data: { position: { increment: OFFSET } },
        });

        for (let i = 0; i < ordered.length; i++) {
            await tx.comicPage.update({
                where: {
                    comicId_mediaId: {
                        comicId: input.comicId,
                        mediaId: ordered[i],
                    },
                },
                data: { position: i + 1 },
            });
        }

        await recomputeLastPageMediaId(tx, input.comicId);

        return { ok: true };
    });
}

export async function getComic(input: { comicId: string; viewer?: Viewer }) {
    return prisma.$transaction(async (tx) => {
        const comic = await tx.comic.findUnique({
            where: { id: input.comicId },
            select: {
                id: true,
                title: true,
                status: true,
                createdById: true,
                coverMediaId: true,
                lastPageAddedAt: true,
                lastPageMediaId: true,
                randomKey: true,
                isExplicit: true,
                ratingAvg: true,
                ratingCount: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!comic) throw new Error('NOT_FOUND');

        if (
            input.viewer &&
            !isModerator(input.viewer) &&
            comic.createdById !== input.viewer.id
        ) {
            throw new Error('FORBIDDEN');
        }

        const pages = await tx.comicPage.findMany({
            where: { comicId: input.comicId },
            orderBy: { position: 'asc' },
            select: { mediaId: true, position: true, addedAt: true },
        });

        const tags = await tx.comicTags.findMany({
            where: { comicId: input.comicId },
            select: {
                tag: { select: { id: true, name: true, isExplicit: true } },
            },
        });

        return {
            ...comic,
            pages,
            tags: tags.map((t) => t.tag),
        };
    });
}
