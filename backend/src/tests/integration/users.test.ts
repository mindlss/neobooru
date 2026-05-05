import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';

const app = createApp();

function userPayload() {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
        username: `me_${suffix}`.slice(0, 32),
        email: `me_${suffix}@example.test`,
        password: 'password123',
    };
}

describe('users integration', () => {
    it('returns current user for authenticated requests', async () => {
        const body = userPayload();
        const registered = await request(app)
            .post('/auth/register')
            .send(body)
            .expect(201);

        const res = await request(app)
            .get('/users/me')
            .set('Cookie', registered.headers['set-cookie'])
            .expect(200);

        expect(res.body).toMatchObject({
            username: body.username,
            email: body.email,
            roles: ['unverified'],
            permissions: [],
        });
        expect(res.body.id).toEqual(expect.any(String));
    });

    it('rejects unauthenticated current user requests', async () => {
        const res = await request(app).get('/users/me').expect(401);

        expect(res.body.error).toMatchObject({
            code: 'UNAUTHORIZED',
        });
    });
});
