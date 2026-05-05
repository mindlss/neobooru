import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { Permission } from '../../domain/auth/permissions';
import {
    createApprovedMedia,
    createTag,
    ensureGeneralCategory,
    registerUserWithPermissions,
} from './helpers';

const app = createApp();

describe('tags endpoints integration', () => {
    it('serves public popular/search endpoints with explicit filtering', async () => {
        const cat = await ensureGeneralCategory();
        const safe = await createTag({ name: 'cat', usageCount: 10 });
        const explicit = await createTag({
            name: 'cat_explicit',
            usageCount: 50,
            isExplicit: true,
        });
        await prisma.tagAlias.create({
            data: {
                tagId: safe.id,
                alias: 'kitty',
            },
        });

        const popularGuest = await request(app)
            .get('/tags/popular')
            .query({ limit: 10 })
            .expect(200);

        expect(popularGuest.body.data.map((t: any) => t.name)).toContain(
            safe.name,
        );
        expect(popularGuest.body.data.map((t: any) => t.name)).not.toContain(
            explicit.name,
        );

        const searchGuest = await request(app)
            .get('/tags/search')
            .query({ q: 'ki', limit: 10 })
            .expect(200);

        expect(searchGuest.body.data).toEqual([
            expect.objectContaining({
                kind: 'alias',
                name: 'kitty',
                canonicalId: safe.id,
                canonicalName: safe.name,
            }),
        ]);

        expect(cat.name).toBe('general');
    });

    it('creates, patches, lists, creates, and deletes tag aliases with staff permissions', async () => {
        const staff = await registerUserWithPermissions(app, [
            Permission.TAGS_MANAGE,
            Permission.TAGS_ALIASES_MANAGE,
        ]);
        const category = await ensureGeneralCategory();

        const created = await request(app)
            .post('/tags')
            .set('Cookie', staff.cookie)
            .send({ name: 'Big Cat', categoryId: category.id })
            .expect(201);

        expect(created.body).toMatchObject({
            name: 'big_cat',
            categoryId: category.id,
            usageCount: 0,
            isExplicit: false,
        });

        const patched = await request(app)
            .patch(`/tags/${created.body.id}`)
            .set('Cookie', staff.cookie)
            .send({ customColor: '#ff00aa', isExplicit: true })
            .expect(200);

        expect(patched.body).toMatchObject({
            id: created.body.id,
            name: 'big_cat',
            color: '#ff00aa',
            customColor: '#ff00aa',
            isExplicit: true,
        });

        const alias = await request(app)
            .post(`/tags/${created.body.id}/aliases`)
            .set('Cookie', staff.cookie)
            .send({ alias: 'Huge Cat' })
            .expect(201);

        expect(alias.body).toMatchObject({
            alias: 'huge_cat',
            tagId: created.body.id,
        });

        await request(app)
            .get(`/tags/${created.body.id}/aliases`)
            .set('Cookie', staff.cookie)
            .expect(200)
            .expect(({ body }) => {
                expect(body.data).toEqual([
                    expect.objectContaining({ id: alias.body.id }),
                ]);
            });

        await request(app)
            .delete(`/tags/aliases/${alias.body.id}`)
            .set('Cookie', staff.cookie)
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ status: 'ok' });
            });

        await expect(
            prisma.tagAlias.findUnique({ where: { id: alias.body.id } }),
        ).resolves.toBeNull();
    });

    it('adds, sets, and removes media tags through owner permissions', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.MEDIA_TAGS_EDIT_OWN,
        ]);
        await ensureGeneralCategory();
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/tags/add`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['Cat', 'Dog'] })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ status: 'ok' });
            });

        await expect(
            prisma.mediaTags.count({ where: { mediaId: media.id } }),
        ).resolves.toBe(2);

        await request(app)
            .post(`/media/${media.id}/tags`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['Cat'] })
            .expect(200);

        const afterSet = await prisma.tag.findMany({
            where: { mediaLinks: { some: { mediaId: media.id } } },
            orderBy: { name: 'asc' },
        });
        expect(afterSet.map((t) => t.name)).toEqual(['cat']);

        await request(app)
            .post(`/media/${media.id}/tags/remove`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['Cat'] })
            .expect(200);

        await expect(
            prisma.mediaTags.count({ where: { mediaId: media.id } }),
        ).resolves.toBe(0);
    });

    it('returns tag endpoint authz and validation errors', async () => {
        const actor = await registerUserWithPermissions(app, []);
        const category = await ensureGeneralCategory();
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post('/tags')
            .set('Cookie', actor.cookie)
            .send({ name: 'tag', categoryId: category.id })
            .expect(403)
            .expect(({ body }) => {
                expect(body.error.code).toBe('FORBIDDEN');
            });

        await request(app)
            .post(`/media/${media.id}/tags/add`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['cat'] })
            .expect(403)
            .expect(({ body }) => {
                expect(body.error.code).toBe('FORBIDDEN');
            });

        const staff = await registerUserWithPermissions(app, [
            Permission.TAGS_MANAGE,
        ]);

        await request(app)
            .post('/tags')
            .set('Cookie', staff.cookie)
            .send({ name: 'tag', categoryId: 'not-a-uuid' })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error.code).toBe('VALIDATION_ERROR');
            });
    });
});
