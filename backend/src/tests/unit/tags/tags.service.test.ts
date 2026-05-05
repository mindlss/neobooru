import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Permission } from '../../../domain/auth/permissions';

const { prisma } = vi.hoisted(() => ({
    prisma: {
        $transaction: vi.fn(),
        tag: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        tagAlias: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        tagCategory: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('../../../lib/prisma', () => ({ prisma }));

import {
    addTagsToMedia,
    createAlias,
    createTag,
    listPopularTags,
    searchTagsAutocomplete,
} from '../../../domain/tags/tags.service';

function createTx() {
    return {
        media: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        mediaTags: {
            findMany: vi.fn(),
            createMany: vi.fn(),
            count: vi.fn(),
        },
        tag: {
            updateMany: vi.fn(),
        },
        comicPage: {
            findMany: vi.fn(),
        },
        comic: {
            updateMany: vi.fn(),
            update: vi.fn(),
        },
    };
}

describe('tags service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prisma.$transaction.mockImplementation((arg: any) => {
            if (Array.isArray(arg)) return Promise.all(arg);
            return arg(createTx());
        });
    });

    it('searches tags and aliases, applies explicit visibility, dedupes, sorts, and clamps limit', async () => {
        prisma.tag.findMany.mockResolvedValue([
            {
                id: 'tag-1',
                name: 'cat',
                usageCount: 10,
                customColor: null,
                category: { id: 'cat-1', name: 'general', color: '#aaa' },
            },
            {
                id: 'tag-2',
                name: 'car',
                usageCount: 10,
                customColor: '#f00',
                category: { id: 'cat-1', name: 'general', color: '#aaa' },
            },
        ]);
        prisma.tagAlias.findMany.mockResolvedValue([
            {
                id: 'alias-1',
                alias: 'kitty',
                tag: {
                    id: 'tag-1',
                    name: 'cat',
                    usageCount: 12,
                    customColor: null,
                    category: {
                        id: 'cat-1',
                        name: 'general',
                        color: '#aaa',
                    },
                },
            },
        ]);

        await expect(
            searchTagsAutocomplete({
                q: 'Ca ',
                limit: 500,
                viewer: { id: 'viewer-1', isAdult: false },
            }),
        ).resolves.toEqual([
            {
                kind: 'alias',
                id: 'alias-1',
                name: 'kitty',
                usageCount: 12,
                categoryId: 'cat-1',
                categoryName: 'general',
                color: '#aaa',
                customColor: null,
                canonicalId: 'tag-1',
                canonicalName: 'cat',
            },
            {
                kind: 'tag',
                id: 'tag-2',
                name: 'car',
                usageCount: 10,
                categoryId: 'cat-1',
                categoryName: 'general',
                color: '#f00',
                customColor: '#f00',
                canonicalId: 'tag-2',
                canonicalName: 'car',
            },
            {
                kind: 'tag',
                id: 'tag-1',
                name: 'cat',
                usageCount: 10,
                categoryId: 'cat-1',
                categoryName: 'general',
                color: '#aaa',
                customColor: null,
                canonicalId: 'tag-1',
                canonicalName: 'cat',
            },
        ]);

        expect(prisma.tag.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    name: { startsWith: 'ca' },
                    isExplicit: false,
                },
                take: 50,
            }),
        );
        expect(prisma.tagAlias.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    alias: { startsWith: 'ca' },
                    tag: { isExplicit: false },
                },
                take: 100,
            }),
        );
    });

    it('allows adult or privileged viewers to see explicit popular tags', async () => {
        prisma.tag.findMany.mockResolvedValue([
            {
                id: 'tag-1',
                name: 'explicit',
                usageCount: 3,
                customColor: null,
                category: { id: 'cat-1', name: 'general', color: '#aaa' },
            },
        ]);

        await listPopularTags({
            limit: 0,
            viewer: { id: 'viewer-1', isAdult: true },
        });
        expect(prisma.tag.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({
                where: {},
                take: 1,
            }),
        );

        await listPopularTags({
            limit: 5,
            viewer: { id: 'viewer-1', isAdult: false },
            principal: {
                id: 'viewer-1',
                permissions: [Permission.MEDIA_READ_EXPLICIT],
            },
        });
        expect(prisma.tag.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({
                where: {},
                take: 5,
            }),
        );
    });

    it('normalizes tag names when creating tags', async () => {
        const created = {
            id: 'tag-1',
            name: 'big_cat',
            usageCount: 0,
            categoryId: 'cat-1',
            isExplicit: false,
        };
        prisma.tag.create.mockResolvedValue(created);

        await expect(
            createTag({ name: ' Big   Cat ', categoryId: 'cat-1' }),
        ).resolves.toBe(created);

        expect(prisma.tag.create).toHaveBeenCalledWith({
            data: { name: 'big_cat', categoryId: 'cat-1' },
            select: {
                id: true,
                name: true,
                usageCount: true,
                categoryId: true,
                isExplicit: true,
            },
        });
    });

    it('creates normalized aliases after checking collisions', async () => {
        prisma.tag.findUnique
            .mockResolvedValueOnce({ id: 'tag-1', name: 'cat' })
            .mockResolvedValueOnce(null);
        prisma.tagAlias.create.mockResolvedValue({
            id: 'alias-1',
            alias: 'kitty_cat',
            tagId: 'tag-1',
        });

        await expect(
            createAlias({ tagId: 'tag-1', alias: ' Kitty Cat ' }),
        ).resolves.toEqual({
            id: 'alias-1',
            alias: 'kitty_cat',
            tagId: 'tag-1',
        });

        expect(prisma.tagAlias.create).toHaveBeenCalledWith({
            data: { tagId: 'tag-1', alias: 'kitty_cat' },
            select: { id: true, alias: true, tagId: true },
        });
    });

    it('rejects invalid aliases, aliases equal to tag name, and tag-name collisions', async () => {
        await expect(
            createAlias({ tagId: 'tag-1', alias: '   ' }),
        ).rejects.toThrow('ALIAS_INVALID');

        prisma.tag.findUnique.mockReset();
        prisma.tag.findUnique.mockResolvedValueOnce({ id: 'tag-1', name: 'cat' });
        await expect(
            createAlias({ tagId: 'tag-1', alias: ' cat ' }),
        ).rejects.toThrow('ALIAS_SAME_AS_TAG');

        prisma.tag.findUnique.mockReset();
        prisma.tag.findUnique
            .mockResolvedValueOnce({ id: 'tag-1', name: 'cat' })
            .mockResolvedValueOnce({ id: 'tag-2' });
        await expect(
            createAlias({ tagId: 'tag-1', alias: 'dog' }),
        ).rejects.toThrow('ALIAS_COLLIDES_WITH_TAG');
    });

    it('adds resolved tags to media and increments usage only for newly attached tags', async () => {
        const tx = createTx();
        prisma.$transaction.mockImplementation((arg: any) => {
            if (Array.isArray(arg)) return Promise.all(arg);
            return arg(tx);
        });

        prisma.tagAlias.findMany.mockResolvedValue([
            { alias: 'kitty', tag: { name: 'cat' } },
        ]);
        prisma.tagCategory.findUnique.mockResolvedValue({ id: 'general-1' });
        prisma.tag.findMany.mockResolvedValue([
            { id: 'tag-cat', name: 'cat' },
        ]);
        prisma.tag.create.mockResolvedValue({
            id: 'tag-new',
            name: 'new_tag',
        });

        tx.media.findUnique.mockResolvedValue({
            id: 'media-1',
            uploadedById: 'user-1',
            deletedAt: null,
            isExplicit: false,
        });
        tx.mediaTags.findMany
            .mockResolvedValueOnce([{ tagId: 'tag-cat' }])
            .mockResolvedValueOnce([
                { tagId: 'tag-cat' },
                { tagId: 'tag-new' },
            ]);
        tx.mediaTags.count.mockResolvedValue(0);
        tx.comicPage.findMany.mockResolvedValue([]);

        await expect(
            addTagsToMedia({
                mediaId: 'media-1',
                tagNames: ['Kitty', 'new tag'],
                principal: {
                    id: 'user-1',
                    permissions: [Permission.MEDIA_TAGS_EDIT_OWN],
                },
            }),
        ).resolves.toEqual({ ok: true });

        expect(tx.mediaTags.createMany).toHaveBeenCalledWith({
            data: [
                { mediaId: 'media-1', tagId: 'tag-cat' },
                { mediaId: 'media-1', tagId: 'tag-new' },
            ],
            skipDuplicates: true,
        });
        expect(tx.tag.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['tag-new'] } },
            data: { usageCount: { increment: 1 } },
        });
        expect(tx.media.update).not.toHaveBeenCalled();
    });
});
