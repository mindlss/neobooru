import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { Permission } from '../../domain/auth/permissions';
import {
    createApprovedMedia,
    ensureGeneralCategory,
    registerUserWithPermissions,
    userPayload,
} from './helpers';

const app = createApp();

function expectValidationIssue(body: any, path: Array<string | number>, code?: string) {
    expect(body.error).toEqual(
        expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            requestId: expect.any(String),
            details: {
                issues: expect.arrayContaining([
                    expect.objectContaining({
                        path,
                        ...(code ? { code } : {}),
                        message: expect.any(String),
                    }),
                ]),
            },
        }),
    );
}

describe('validation boundary integration', () => {
    it('enforces auth register field boundaries', async () => {
        await request(app)
            .post('/auth/register')
            .send({
                username: 'ab',
                email: 'not-email',
                password: '1234567',
            })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['username'], 'too_small');
                expectValidationIssue(body, ['email'], 'invalid_string');
                expectValidationIssue(body, ['password'], 'too_small');
            });

        const minValid = userPayload('min');
        minValid.username = 'abc';
        minValid.password = '12345678';

        await request(app)
            .post('/auth/register')
            .send(minValid)
            .expect(201)
            .expect(({ body }) => {
                expect(body.user.username).toBe('abc');
            });
    });

    it('enforces rating min and max value boundaries', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.RATINGS_SET,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 0 })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['value'], 'too_small');
                expect(body.error.details.issues[0]).toEqual(
                    expect.objectContaining({ minimum: 1 }),
                );
            });

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 11 })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['value'], 'too_big');
                expect(body.error.details.issues[0]).toEqual(
                    expect.objectContaining({ maximum: 10 }),
                );
            });

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 1 })
            .expect(200)
            .expect(({ body }) => {
                expect(body.myRating).toBe(1);
            });

        await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 10 })
            .expect(200)
            .expect(({ body }) => {
                expect(body.myRating).toBe(10);
            });
    });

    it('enforces tag query limit boundaries', async () => {
        await ensureGeneralCategory();

        await request(app)
            .get('/tags/search')
            .query({ q: 'cat', limit: 0 })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['limit'], 'too_small');
            });

        await request(app)
            .get('/tags/search')
            .query({ q: 'cat', limit: 51 })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['limit'], 'too_big');
            });

        await request(app)
            .get('/tags/search')
            .query({ q: 'cat', limit: 1 })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ data: expect.any(Array) });
            });
    });

    it('enforces media tag body array boundaries', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.MEDIA_TAGS_EDIT_OWN,
        ]);
        await ensureGeneralCategory();
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/tags/add`)
            .set('Cookie', actor.cookie)
            .send({ tags: [] })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['tags'], 'too_small');
            });

        await request(app)
            .post(`/media/${media.id}/tags/add`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['a'.repeat(65)] })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['tags', 0], 'too_big');
            });

        await request(app)
            .post(`/media/${media.id}/tags/add`)
            .set('Cookie', actor.cookie)
            .send({ tags: ['a'.repeat(64)] })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ status: 'ok' });
            });
    });

    it('enforces comment content length and cursor boundaries', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.COMMENTS_CREATE,
            Permission.COMMENTS_READ,
        ]);
        const media = await createApprovedMedia(actor.user.id);

        await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: '' })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['content'], 'too_small');
            });

        await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: 'x'.repeat(5001) })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['content'], 'too_big');
            });

        await request(app)
            .post(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .send({ content: 'x'.repeat(5000) })
            .expect(201)
            .expect(({ body }) => {
                expect(body.content).toHaveLength(5000);
            });

        await request(app)
            .get(`/media/${media.id}/comments`)
            .set('Cookie', actor.cookie)
            .query({ cursor: 'not-a-uuid' })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['cursor'], 'invalid_string');
            });
    });

    it('enforces uuid path parameter validation', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.RATINGS_SET,
        ]);

        await request(app)
            .post('/media/not-a-uuid/rating')
            .set('Cookie', actor.cookie)
            .send({ value: 5 })
            .expect(400)
            .expect(({ body }) => {
                expectValidationIssue(body, ['id'], 'invalid_string');
            });
    });
});
