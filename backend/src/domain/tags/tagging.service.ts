import { prisma } from '../../lib/prisma';
import type { UserRole } from '@prisma/client';

type Viewer = { id?: string; role: UserRole; isAdult: boolean } | undefined;

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function tagVisibilityWhere(viewer: Viewer) {
    // explicit-теги скрываем всем, кто не 18+
    if (!viewer?.isAdult) return { isExplicit: false };
    return {};
}

async function resolveNames(names: string[]) {
    const normalized = Array.from(new Set(names.map(normalizeTagName))).filter(
        Boolean
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
                })
            )
        );
        for (const t of created) existingMap.set(t.name, t);
    }

    return resolved.map((n) => existingMap.get(n)!);
}

export async function addTagsToMedia(mediaId: string, tagNames: string[]) {
    const tags = await getOrCreateTags(tagNames);

    await prisma.$transaction(async (tx) => {
        await tx.mediaTags.createMany({
            data: tags.map((t) => ({ mediaId, tagId: t.id })),
            skipDuplicates: true,
        });

        const links = await tx.mediaTags.findMany({
            where: { mediaId, tagId: { in: tags.map((t) => t.id) } },
            select: { tagId: true },
        });
        const present = new Set(links.map((l) => l.tagId));

        const before = await tx.mediaTags.findMany({
            where: { mediaId },
            select: { tagId: true },
        });
        const beforeSet = new Set(before.map((l) => l.tagId));

        const newlyAdded = Array.from(present).filter(
            (id) => !beforeSet.has(id)
        );

        if (newlyAdded.length > 0) {
            await tx.tag.updateMany({
                where: { id: { in: newlyAdded } },
                data: { usageCount: { increment: 1 } },
            });
        }
    });

    return { ok: true };
}

export async function removeTagsFromMedia(mediaId: string, tagNames: string[]) {
    const resolved = await resolveNames(tagNames);

    const tags = await prisma.tag.findMany({
        where: { name: { in: resolved } },
        select: { id: true },
    });

    const tagIds = tags.map((t) => t.id);
    if (tagIds.length === 0) return { ok: true };

    await prisma.$transaction(async (tx) => {
        const existingLinks = await tx.mediaTags.findMany({
            where: { mediaId, tagId: { in: tagIds } },
            select: { tagId: true },
        });

        const existingIds = existingLinks.map((l) => l.tagId);
        if (existingIds.length === 0) return;

        await tx.mediaTags.deleteMany({
            where: { mediaId, tagId: { in: existingIds } },
        });

        await tx.tag.updateMany({
            where: { id: { in: existingIds } },
            data: { usageCount: { decrement: 1 } },
        });
    });

    return { ok: true };
}

export async function setTagsForMedia(mediaId: string, tagNames: string[]) {
    const tags = await getOrCreateTags(tagNames);
    const wantedIds = new Set(tags.map((t) => t.id));

    await prisma.$transaction(async (tx) => {
        const current = await tx.mediaTags.findMany({
            where: { mediaId },
            select: { tagId: true },
        });

        const currentIds = new Set(current.map((l) => l.tagId));

        const toAdd = Array.from(wantedIds).filter((id) => !currentIds.has(id));
        const toRemove = Array.from(currentIds).filter(
            (id) => !wantedIds.has(id)
        );

        if (toAdd.length > 0) {
            await tx.mediaTags.createMany({
                data: toAdd.map((tagId) => ({ mediaId, tagId })),
                skipDuplicates: true,
            });

            await tx.tag.updateMany({
                where: { id: { in: toAdd } },
                data: { usageCount: { increment: 1 } },
            });
        }

        if (toRemove.length > 0) {
            await tx.mediaTags.deleteMany({
                where: { mediaId, tagId: { in: toRemove } },
            });

            await tx.tag.updateMany({
                where: { id: { in: toRemove } },
                data: { usageCount: { decrement: 1 } },
            });
        }
    });

    return { ok: true };
}

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
}) {
    const query = normalizeTagName(params.q);
    const take = Math.min(Math.max(params.limit, 1), 50);

    // canonical tags
    const tags = await prisma.tag.findMany({
        where: {
            name: { startsWith: query },
            ...tagVisibilityWhere(params.viewer),
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

    // aliases
    const aliases = await prisma.tagAlias.findMany({
        where: {
            alias: { startsWith: query },
            tag: {
                ...tagVisibilityWhere(params.viewer),
            },
        },
        take: take * 2,
        include: {
            tag: {
                include: {
                    category: true,
                },
            },
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
}) {
    const take = Math.min(Math.max(params.limit, 1), 200);

    const tags = await prisma.tag.findMany({
        where: {
            ...tagVisibilityWhere(params.viewer),
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

export async function patchTag(
    tagId: string,
    input: { customColor?: string | null; isExplicit?: boolean }
) {
    const tag = await prisma.tag.update({
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
    const rows = await prisma.tagAlias.findMany({
        where: { tagId },
        orderBy: { alias: 'asc' },
        select: { id: true, alias: true, tagId: true },
    });

    return rows;
}

export async function deleteAlias(aliasId: string) {
    await prisma.tagAlias.delete({ where: { id: aliasId } });
    return { ok: true };
}
