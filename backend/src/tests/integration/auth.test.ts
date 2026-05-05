import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

const app = createApp();

function uniqueUser() {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
        username: `user_${suffix}`.slice(0, 32),
        email: `user_${suffix}@example.test`,
        password: 'password123',
    };
}

describe('auth integration', () => {
    it('registers a user, assigns default role, and sets auth cookies', async () => {
        const body = uniqueUser();

        const res = await request(app)
            .post('/auth/register')
            .send(body)
            .expect(201);

        expect(res.body.user).toMatchObject({
            username: body.username,
            email: body.email,
        });
        expect(res.body.user.password).toBeUndefined();
        expect(res.headers['set-cookie']).toEqual(
            expect.arrayContaining([
                expect.stringContaining('accessToken='),
                expect.stringContaining('refreshToken='),
            ]),
        );

        const user = await prisma.user.findUnique({
            where: { email: body.email },
            include: { assignments: { include: { role: true } } },
        });

        expect(user).not.toBeNull();
        expect(user?.assignments.map((a) => a.role.key)).toContain(
            'unverified',
        );
    });

    it('logs in with registered credentials and rejects wrong password', async () => {
        const body = uniqueUser();

        await request(app).post('/auth/register').send(body).expect(201);

        const ok = await request(app)
            .post('/auth/login')
            .send({ email: body.email, password: body.password })
            .expect(200);

        expect(ok.body.user).toMatchObject({
            username: body.username,
            email: body.email,
        });
        expect(ok.headers['set-cookie']).toEqual(
            expect.arrayContaining([expect.stringContaining('accessToken=')]),
        );

        const bad = await request(app)
            .post('/auth/login')
            .send({ email: body.email, password: 'wrong-password' })
            .expect(401);

        expect(bad.body.error).toMatchObject({
            code: 'INVALID_CREDENTIALS',
        });
    });

    it('refreshes tokens and rejects reused refresh token', async () => {
        const body = uniqueUser();

        const registered = await request(app)
            .post('/auth/register')
            .send(body)
            .expect(201);

        const cookie = registered.headers['set-cookie'];

        const refreshed = await request(app)
            .post('/auth/refresh')
            .set('Cookie', cookie)
            .expect(200);

        expect(refreshed.body).toEqual({ status: 'ok' });
        expect(refreshed.headers['set-cookie']).toEqual(
            expect.arrayContaining([
                expect.stringContaining('accessToken='),
                expect.stringContaining('refreshToken='),
            ]),
        );

        const reused = await request(app)
            .post('/auth/refresh')
            .set('Cookie', cookie)
            .expect(401);

        expect(reused.body.error.code).toBe('UNAUTHORIZED');
    });
});
