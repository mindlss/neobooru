import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { Permission } from '../../domain/auth/permissions';
import { createApprovedMedia, registerUserWithPermissions, userPayload } from './helpers';

const app = createApp();

function expectErrorEnvelope(body: any, code: string) {
    expect(body).toEqual({
        error: expect.objectContaining({
            code,
            message: expect.any(String),
            requestId: expect.any(String),
        }),
    });
}

describe('response codes and response structure integration', () => {
    it('returns 201 and a stable auth response shape for registration', async () => {
        const payload = userPayload('shape');

        const res = await request(app)
            .post('/auth/register')
            .send(payload)
            .expect(201);

        expect(res.body).toEqual({
            user: expect.objectContaining({
                id: expect.any(String),
                username: payload.username,
                email: payload.email,
                createdAt: expect.any(String),
            }),
        });
        expect(res.body.user.password).toBeUndefined();
        expect(res.headers['set-cookie']).toEqual(
            expect.arrayContaining([
                expect.stringContaining('accessToken='),
                expect.stringContaining('refreshToken='),
            ]),
        );
    });

    it('returns 200 and a stable self profile shape for authenticated users', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.USERS_UPDATE_SELF,
        ]);

        const res = await request(app)
            .get('/users/me')
            .set('Cookie', actor.cookie)
            .expect(200);

        expect(res.body).toEqual(
            expect.objectContaining({
                id: actor.user.id,
                username: actor.user.username,
                email: actor.user.email,
                roles: expect.arrayContaining(['unverified']),
                permissions: expect.arrayContaining([
                    Permission.USERS_UPDATE_SELF,
                ]),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                showComments: expect.any(Boolean),
                showRatings: expect.any(Boolean),
                showFavorites: expect.any(Boolean),
                showUploads: expect.any(Boolean),
            }),
        );
    });

    it('returns 401 with a standard error envelope when auth is missing', async () => {
        const res = await request(app).get('/users/me').expect(401);

        expectErrorEnvelope(res.body, 'UNAUTHORIZED');
    });

    it('returns 403 with required permissions in details when auth lacks permission', async () => {
        const actor = await registerUserWithPermissions(app, []);
        const media = await createApprovedMedia(actor.user.id);

        const res = await request(app)
            .post(`/media/${media.id}/rating`)
            .set('Cookie', actor.cookie)
            .send({ value: 5 })
            .expect(403);

        expectErrorEnvelope(res.body, 'FORBIDDEN');
        expect(res.body.error.details).toEqual({
            required: [Permission.RATINGS_SET],
        });
    });

    it('returns 404 with a standard error envelope for unknown routes', async () => {
        const res = await request(app).get('/does/not/exist').expect(404);

        expectErrorEnvelope(res.body, 'NOT_FOUND');
    });

    it('returns 409 with conflict details for duplicate unique data', async () => {
        const payload = userPayload('dupe');

        await request(app).post('/auth/register').send(payload).expect(201);
        const res = await request(app)
            .post('/auth/register')
            .send(payload)
            .expect(409);

        expectErrorEnvelope(res.body, 'CONFLICT');
        expect(res.body.error.details).toEqual({
            target: expect.any(Array),
        });
    });

    it('returns 400 INVALID_JSON for malformed JSON bodies', async () => {
        const res = await request(app)
            .post('/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email":')
            .expect(400);

        expectErrorEnvelope(res.body, 'INVALID_JSON');
    });
});
