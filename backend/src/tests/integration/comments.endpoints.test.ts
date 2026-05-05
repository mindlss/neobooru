import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { Permission } from '../../domain/auth/permissions';
import {
    createApprovedMedia,
    registerUserWithPermissions,
} from './helpers';

const app = createApp();

describe('comments endpoints integration', () => {
    it('creates, lists, and soft-deletes comments through HTTP', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.COMMENTS_CREATE,
            Permission.COMMENTS_READ,
            Permission.COMMENTS_DELETE_OWN,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        const created = await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: ' first comment ' })
            .expect(201);

        expect(created.body).toMatchObject({
            mediaId: media.id,
            userId: actor.user.id,
            parentId: null,
            content: 'first comment',
            isDeleted: false,
            user: { id: actor.user.id, username: actor.user.username },
        });

        const listed = await request(app)
            .get(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .query({ limit: 10, sort: 'old' })
            .expect(200);

        expect(listed.body).toMatchObject({
            data: [expect.objectContaining({ id: created.body.id })],
            nextCursor: null,
        });

        await request(app)
            .delete(`/comments/${created.body.id}`)
            .set('Cookie', actor.cookie)
            .send({ reason: 'ignored for owner' })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ status: 'ok' });
            });

        const deleted = await prisma.comment.findUniqueOrThrow({
            where: { id: created.body.id },
        });
        expect(deleted.deletedAt).toBeInstanceOf(Date);
        expect(deleted.deletedReason).toBeNull();

        const mediaAfterDelete = await prisma.media.findUniqueOrThrow({
            where: { id: media.id },
        });
        expect(mediaAfterDelete.commentCount).toBe(0);
    });

    it('supports replies and paginated comment listing', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.COMMENTS_CREATE,
            Permission.COMMENTS_READ,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        const parent = await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: 'parent' })
            .expect(201);

        const reply = await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: 'reply', parentId: parent.body.id })
            .expect(201);

        expect(reply.body.parentId).toBe(parent.body.id);

        const firstPage = await request(app)
            .get(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .query({ limit: 1, sort: 'old' })
            .expect(200);

        expect(firstPage.body.data).toHaveLength(1);
        expect(firstPage.body.data[0].id).toBe(parent.body.id);
        expect(firstPage.body.nextCursor).toBe(reply.body.id);

        const secondPage = await request(app)
            .get(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .query({ limit: 1, sort: 'old', cursor: firstPage.body.nextCursor })
            .expect(200);

        expect(secondPage.body.data).toHaveLength(0);
        expect(secondPage.body.nextCursor).toBeNull();
    });

    it('returns endpoint errors for unauthorized, invalid, and missing comment flows', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.COMMENTS_CREATE,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .get(`/media/${media.id}/comments`)
            .expect(401)
            .expect(({ body }) => {
                expect(body.error.code).toBe('UNAUTHORIZED');
            });

        await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: '   ' })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error.code).toBe('VALIDATION_ERROR');
            });

        await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({
                content: 'reply',
                parentId: '00000000-0000-0000-0000-000000000000',
            })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error.code).toBe('PARENT_NOT_FOUND');
            });
    });
});
