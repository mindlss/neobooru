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

describe('ratings endpoints integration', () => {
    it('sets, updates, and removes a media rating through HTTP', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.RATINGS_SET,
            Permission.RATINGS_REMOVE,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 7 })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    status: 'ok',
                    mediaId: media.id,
                    ratingAvg: 7,
                    ratingCount: 1,
                    myRating: 7,
                });
            });

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 9 })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    ratingAvg: 9,
                    ratingCount: 1,
                    myRating: 9,
                });
            });

        const ratedMedia = await prisma.media.findUniqueOrThrow({
            where: { id: media.id },
        });
        expect(ratedMedia.ratingSum).toBe(9);
        expect(ratedMedia.ratingCount).toBe(1);
        expect(ratedMedia.ratingAvg).toBe(9);

        await request(app)
            .delete(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .expect(200)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    status: 'ok',
                    mediaId: media.id,
                    ratingAvg: 0,
                    ratingCount: 0,
                    myRating: null,
                });
            });

        await expect(
            prisma.rating.findUnique({
                where: {
                    mediaId_userId: {
                        mediaId: media.id,
                        userId: actor.user.id,
                    },
                },
            }),
        ).resolves.toBeNull();
    });

    it('returns authz, validation, and not-found errors from rating endpoints', async () => {
        const actor = await registerUserWithPermissions(app, []);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 5 })
            .expect(403)
            .expect(({ body }) => {
                expect(body.error.code).toBe('FORBIDDEN');
            });

        const rater = await registerUserWithPermissions(app, [
            Permission.RATINGS_SET,
        ]);

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', rater.cookie)
            .send({ value: 11 })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error.code).toBe('VALIDATION_ERROR');
            });

        await request(app)
            .post('/media/00000000-0000-0000-0000-000000000000/rating')
            .set('Cookie', rater.cookie)
            .send({ value: 5 })
            .expect(404)
            .expect(({ body }) => {
                expect(body.error.code).toBe('NOT_FOUND');
            });
    });
});

describe('favorites endpoints integration', () => {
    it('adds and removes a favorite through HTTP', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.FAVORITES_ADD,
            Permission.FAVORITES_REMOVE,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/favorite`)
            .set('Cookie', actor.cookie)
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ status: 'ok' });
            });

        await expect(
            prisma.favorite.findUnique({
                where: {
                    userId_mediaId: {
                        userId: actor.user.id,
                        mediaId: media.id,
                    },
                },
            }),
        ).resolves.toMatchObject({
            userId: actor.user.id,
            mediaId: media.id,
        });

        await request(app)
            .delete(`/media/${media.id}/favorite`)
            .set('Cookie', actor.cookie)
            .expect(200);

        await expect(
            prisma.favorite.findUnique({
                where: {
                    userId_mediaId: {
                        userId: actor.user.id,
                        mediaId: media.id,
                    },
                },
            }),
        ).resolves.toBeNull();
    });

    it('rejects favorite requests without required permissions or valid ids', async () => {
        const actor = await registerUserWithPermissions(app, []);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/favorite`)
            .set('Cookie', actor.cookie)
            .expect(403)
            .expect(({ body }) => {
                expect(body.error.code).toBe('FORBIDDEN');
            });

        const favoriteUser = await registerUserWithPermissions(app, [
            Permission.FAVORITES_ADD,
        ]);

        await request(app)
            .post('/media/not-a-uuid/favorite')
            .set('Cookie', favoriteUser.cookie)
            .expect(400)
            .expect(({ body }) => {
                expect(body.error.code).toBe('VALIDATION_ERROR');
            });
    });
});
