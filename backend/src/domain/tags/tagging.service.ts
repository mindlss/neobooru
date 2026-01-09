import { prisma } from '../../lib/prisma';

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
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

export async function searchTags(q: string, limit: number) {
    const query = normalizeTagName(q);

    return prisma.tag.findMany({
        where: { name: { startsWith: query } },
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take: limit,
        select: {
            id: true,
            name: true,
            usageCount: true,
            categoryId: true,
        },
    });
}

export async function createTag(input: { name: string; categoryId: string }) {
    const name = normalizeTagName(input.name);

    return prisma.tag.create({
        data: { name, categoryId: input.categoryId },
        select: { id: true, name: true, usageCount: true, categoryId: true },
    });
}
