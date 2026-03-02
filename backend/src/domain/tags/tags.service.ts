import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

import { Permission } from '../auth/permissions';
import type { PrincipalLike } from '../auth/permission.utils';
import { hasPermission } from '../auth/permission.utils';

type Viewer = { id?: string; isAdult: boolean } | undefined;
type Tx = Prisma.TransactionClient;

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Who can see explicit tags:
 * - adult viewer
 * - OR principal has MEDIA_READ_EXPLICIT
 */
function canSeeExplicit(principal: PrincipalLike | undefined, viewer: Viewer) {
    if (viewer?.isAdult) return true;
    return hasPermission(principal, Permission.MEDIA_READ_EXPLICIT);
}

function tagVisibilityWhere(
    principal: PrincipalLike | undefined,
    viewer: Viewer,
) {
    if (!canSeeExplicit(principal, viewer))
        return { isExplicit: false as const };
    return {};
}

async function resolveNames(names: string[]) {
    const normalized = Array.from(new Set(names.map(normalizeTagName))).filter(
        Boolean,
    );
    if (normalized.length === 0) return [];

    const aliases = await prisma.tagAlias.findMany({
        where: { alias: { in: normalized } },
        include: { tag: true },
    });

    const aliasMap = new Map<string, string>();
    for (const a of aliases) aliasMap.set(a.alias, a.tag.name);

    return normalized.map((n) => aliasMap.get(n) ?? n);
}

async function getOrCreateTags(names: string[]) {
    const resolved = await resolveNames(names);

    const general = await prisma.tagCategory.findUnique({
        where: { name: 'general' },
        select: { id: true },
    });
    if (!general) throw new Error('GENERAL_CATEGORY_MISSING');

    const existing = await prisma.tag.findMany({
        where: { name: { in: resolved } },
    });

    const existingMap = new Map(existing.map((t) => [t.name, t]));
    const toCreate = resolved.filter((n) => !existingMap.has(n));

    if (toCreate.length > 0) {
        const created = await prisma.$transaction(
            toCreate.map((name) =>
                prisma.tag.create({
                    data: { name, categoryId: general.id },
                }),
            ),
        );
        for (const t of created) existingMap.set(t.name, t);
    }

    return resolved.map((n) => existingMap.get(n)!);
}

async function recomputeMediaExplicit(tx: Tx, mediaId: string) {
    const before = await tx.media.findUnique({
        where: { id: mediaId },
        select: { isExplicit: true },
    });
    if (!before) throw new Error('NOT_FOUND');

    const cnt = await tx.mediaTags.count({
        where: { mediaId, tag: { isExplicit: true } },
    });

    const nextIsExplicit = cnt > 0;
    if (before.isExplicit === nextIsExplicit) return;

    await tx.media.update({
        where: { id: mediaId },
        data: { isExplicit: nextIsExplicit },
    });

    // comics propagation
    const links = await tx.comicPage.findMany({
        where: { mediaId },
        select: { comicId: true },
        distinct: ['comicId'],
    });
    if (links.length === 0) return;

    if (nextIsExplicit) {
        await tx.comic.updateMany({
            where: { id: { in: links.map((l) => l.comicId) } },
            data: { isExplicit: true },
        });
        return;
    }

    for (const l of links) {
        const anyExplicit = await tx.comicPage.count({
            where: { comicId: l.comicId, media: { isExplicit: true } },
        });

        await tx.comic.update({
            where: { id: l.comicId },
            data: { isExplicit: anyExplicit > 0 },
        });
    }
}

/**
 * Permission check for mutating media tags.
 * - staff: MEDIA_TAGS_EDIT_ANY
 * - owner: MEDIA_TAGS_EDIT_OWN + uploadedById === principal.id
 */
async function assertCanEditMediaTags(
    tx: Tx,
    principal: PrincipalLike,
    mediaId: string,
) {
    if (hasPermission(principal, Permission.MEDIA_TAGS_EDIT_ANY)) return;

    if (!hasPermission(principal, Permission.MEDIA_TAGS_EDIT_OWN)) {
        throw new Error('FORBIDDEN');
    }

    const m = await tx.media.findUnique({
        where: { id: mediaId },
        select: { id: true, uploadedById: true, deletedAt: true },
    });

    if (!m || m.deletedAt) throw new Error('MEDIA_NOT_FOUND');
    if (m.uploadedById !== principal.id) throw new Error('FORBIDDEN');
}

// -------------------- media tag mutations --------------------

export async function addTagsToMedia(input: {
    mediaId: string;
    tagNames: string[];
    principal: PrincipalLike;
}) {
    const tags = await getOrCreateTags(input.tagNames);

    await prisma.$transaction(async (tx) => {
        await assertCanEditMediaTags(tx, input.principal, input.mediaId);

        // snapshot BEFORE
        const before = await tx.mediaTags.findMany({
            where: { mediaId: input.mediaId },
            select: { tagId: true },
        });
        const beforeSet = new Set(before.map((l) => l.tagId));

        await tx.mediaTags.createMany({
            data: tags.map((t) => ({ mediaId: input.mediaId, tagId: t.id })),
            skipDuplicates: true,
        });

        // snapshot AFTER
        const links = await tx.mediaTags.findMany({
            where: {
                mediaId: input.mediaId,
                tagId: { in: tags.map((t) => t.id) },
            },
            select: { tagId: true },
        });
        const present = new Set(links.map((l) => l.tagId));

        const newlyAdded = Array.from(present).filter(
            (id) => !beforeSet.has(id),
        );

        if (newlyAdded.length > 0) {
            await tx.tag.updateMany({
                where: { id: { in: newlyAdded } },
                data: { usageCount: { increment: 1 } },
            });
        }

        await recomputeMediaExplicit(tx, input.mediaId);
    });

    return { ok: true };
}

export async function removeTagsFromMedia(input: {
    mediaId: string;
    tagNames: string[];
    principal: PrincipalLike;
}) {
    const resolved = await resolveNames(input.tagNames);

    const tags = await prisma.tag.findMany({
        where: { name: { in: resolved } },
        select: { id: true },
    });

    const tagIds = tags.map((t) => t.id);
    if (tagIds.length === 0) return { ok: true };

    await prisma.$transaction(async (tx) => {
        await assertCanEditMediaTags(tx, input.principal, input.mediaId);

        const existingLinks = await tx.mediaTags.findMany({
            where: { mediaId: input.mediaId, tagId: { in: tagIds } },
            select: { tagId: true },
        });

        const existingIds = existingLinks.map((l) => l.tagId);
        if (existingIds.length === 0) return;

        await tx.mediaTags.deleteMany({
            where: { mediaId: input.mediaId, tagId: { in: existingIds } },
        });

        await tx.tag.updateMany({
            where: { id: { in: existingIds } },
            data: { usageCount: { decrement: 1 } },
        });

        await recomputeMediaExplicit(tx, input.mediaId);
    });

    return { ok: true };
}

export async function setTagsForMedia(input: {
    mediaId: string;
    tagNames: string[];
    principal: PrincipalLike;
}) {
    const tags = await getOrCreateTags(input.tagNames);
    const wantedIds = new Set(tags.map((t) => t.id));

    await prisma.$transaction(async (tx) => {
        await assertCanEditMediaTags(tx, input.principal, input.mediaId);

        const current = await tx.mediaTags.findMany({
            where: { mediaId: input.mediaId },
            select: { tagId: true },
        });

        const currentIds = new Set(current.map((l) => l.tagId));

        const toAdd = Array.from(wantedIds).filter((id) => !currentIds.has(id));
        const toRemove = Array.from(currentIds).filter(
            (id) => !wantedIds.has(id),
        );

        if (toAdd.length > 0) {
            await tx.mediaTags.createMany({
                data: toAdd.map((tagId) => ({ mediaId: input.mediaId, tagId })),
                skipDuplicates: true,
            });

            await tx.tag.updateMany({
                where: { id: { in: toAdd } },
                data: { usageCount: { increment: 1 } },
            });
        }

        if (toRemove.length > 0) {
            await tx.mediaTags.deleteMany({
                where: { mediaId: input.mediaId, tagId: { in: toRemove } },
            });

            await tx.tag.updateMany({
                where: { id: { in: toRemove } },
                data: { usageCount: { decrement: 1 } },
            });
        }

        await recomputeMediaExplicit(tx, input.mediaId);
    });

    return { ok: true };
}

// -------------------- search / popular --------------------

export type TagSuggestRow =
    | {
          kind: 'tag';
          id: string;
          name: string;
          usageCount: number;
          categoryId: string;
          categoryName: string;
          color: string;
          customColor: string | null;
          canonicalId: string;
          canonicalName: string;
      }
    | {
          kind: 'alias';
          id: string;
          name: string;
          usageCount: number;
          categoryId: string;
          categoryName: string;
          color: string;
          customColor: string | null;
          canonicalId: string;
          canonicalName: string;
      };

export async function searchTagsAutocomplete(params: {
    q: string;
    limit: number;
    viewer: Viewer;
    principal?: PrincipalLike;
}) {
    const query = normalizeTagName(params.q);
    const take = Math.min(Math.max(params.limit, 1), 50);

    const visibility = tagVisibilityWhere(params.principal, params.viewer);

    const tags = await prisma.tag.findMany({
        where: {
            name: { startsWith: query },
            ...visibility,
        },
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take,
        select: {
            id: true,
            name: true,
            usageCount: true,
            customColor: true,
            category: { select: { id: true, name: true, color: true } },
        },
    });

    const aliases = await prisma.tagAlias.findMany({
        where: {
            alias: { startsWith: query },
            tag: { ...visibility },
        },
        take: take * 2,
        include: {
            tag: { include: { category: true } },
        },
    });

    const out: TagSuggestRow[] = [];

    for (const t of tags) {
        out.push({
            kind: 'tag',
            id: t.id,
            name: t.name,
            usageCount: t.usageCount,
            categoryId: t.category.id,
            categoryName: t.category.name,
            color: t.customColor ?? t.category.color,
            customColor: t.customColor ?? null,
            canonicalId: t.id,
            canonicalName: t.name,
        });
    }

    for (const a of aliases) {
        out.push({
            kind: 'alias',
            id: a.id,
            name: a.alias,
            usageCount: a.tag.usageCount,
            categoryId: a.tag.category.id,
            categoryName: a.tag.category.name,
            color: a.tag.customColor ?? a.tag.category.color,
            customColor: a.tag.customColor ?? null,
            canonicalId: a.tag.id,
            canonicalName: a.tag.name,
        });
    }

    // dedupe
    const seen = new Set<string>();
    const deduped: TagSuggestRow[] = [];
    for (const r of out) {
        const k = `${r.kind}:${r.id}`;
        if (!seen.has(k)) {
            seen.add(k);
            deduped.push(r);
        }
    }

    deduped.sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        if (a.kind === b.kind) return 0;
        return a.kind === 'tag' ? -1 : 1;
    });

    return deduped.slice(0, take);
}

export async function listPopularTags(params: {
    limit: number;
    viewer: Viewer;
    principal?: PrincipalLike;
}) {
    const take = Math.min(Math.max(params.limit, 1), 200);

    const visibility = tagVisibilityWhere(params.principal, params.viewer);

    const tags = await prisma.tag.findMany({
        where: { ...visibility },
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take,
        select: {
            id: true,
            name: true,
            usageCount: true,
            customColor: true,
            category: { select: { id: true, name: true, color: true } },
        },
    });

    return tags.map((t) => ({
        id: t.id,
        name: t.name,
        usageCount: t.usageCount,
        categoryId: t.category.id,
        categoryName: t.category.name,
        color: t.customColor ?? t.category.color,
        customColor: t.customColor ?? null,
    }));
}

// -------------------- admin/staff tag management --------------------

export async function patchTag(
    tagId: string,
    input: { customColor?: string | null; isExplicit?: boolean },
) {
    return prisma.$transaction(async (tx) => {
        const tag = await tx.tag.update({
            where: { id: tagId },
            data: {
                ...(input.customColor !== undefined
                    ? { customColor: input.customColor }
                    : {}),
                ...(input.isExplicit !== undefined
                    ? { isExplicit: input.isExplicit }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                usageCount: true,
                customColor: true,
                isExplicit: true,
                category: { select: { id: true, name: true, color: true } },
            },
        });

        if (input.isExplicit !== undefined) {
            const mediaLinks = await tx.mediaTags.findMany({
                where: { tagId },
                select: { mediaId: true },
            });

            const mediaIds = Array.from(
                new Set(mediaLinks.map((l) => l.mediaId)),
            );
            for (const mediaId of mediaIds) {
                await recomputeMediaExplicit(tx, mediaId);
            }
        }

        return {
            id: tag.id,
            name: tag.name,
            usageCount: tag.usageCount,
            categoryId: tag.category.id,
            categoryName: tag.category.name,
            color: tag.customColor ?? tag.category.color,
            customColor: tag.customColor ?? null,
            isExplicit: tag.isExplicit,
        };
    });
}

export async function createTag(input: { name: string; categoryId: string }) {
    const name = normalizeTagName(input.name);

    return prisma.tag.create({
        data: { name, categoryId: input.categoryId },
        select: {
            id: true,
            name: true,
            usageCount: true,
            categoryId: true,
            isExplicit: true,
        },
    });
}

export async function createAlias(params: { tagId: string; alias: string }) {
    const alias = normalizeTagName(params.alias);
    if (!alias) throw new Error('ALIAS_INVALID');

    const tag = await prisma.tag.findUnique({
        where: { id: params.tagId },
        select: { id: true, name: true },
    });
    if (!tag) throw new Error('NOT_FOUND');

    if (alias === tag.name) throw new Error('ALIAS_SAME_AS_TAG');

    const existingTag = await prisma.tag.findUnique({
        where: { name: alias },
        select: { id: true },
    });
    if (existingTag) throw new Error('ALIAS_COLLIDES_WITH_TAG');

    const created = await prisma.tagAlias.create({
        data: { tagId: params.tagId, alias },
        select: { id: true, alias: true, tagId: true },
    });

    return created;
}

export async function listAliasesForTag(tagId: string) {
    return prisma.tagAlias.findMany({
        where: { tagId },
        orderBy: { alias: 'asc' },
        select: { id: true, alias: true, tagId: true },
    });
}

export async function deleteAlias(aliasId: string) {
    await prisma.tagAlias.delete({ where: { id: aliasId } });
    return { ok: true };
}
