import request from 'supertest';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { Permission } from '../../domain/auth/permissions';
import {
    createApprovedMediaWithPreview,
    registerUserWithPermissions,
    userPayload,
} from './helpers';

const app = createApp();

async function pngBuffer() {
    return sharp({
        create: {
            width: 2,
            height: 2,
            channels: 3,
            background: '#ffffff',
        },
    })
        .png()
        .toBuffer();
}

describe('todo fixes integration', () => {
    it('generates a preview and increments uploadCount on media upload', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.MEDIA_UPLOAD,
        ]);

        await request(app)
            .post('/media/upload')
            .set('Cookie', actor.cookie)
            .attach('file', await pngBuffer(), {
                filename: 'pixel.png',
                contentType: 'image/png',
            })
            .expect(201);

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: actor.user.id },
            select: { uploadCount: true },
        });
        expect(user.uploadCount).toBe(1);

        const media = await prisma.media.findFirstOrThrow({
            where: { uploadedById: actor.user.id },
        });
        expect(media.previewKey).toMatch(/^preview\/.+\.webp$/);
    });

    it('does not increment uploadCount when media upload fails', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.MEDIA_UPLOAD,
        ]);

        await request(app)
            .post('/media/upload')
            .set('Cookie', actor.cookie)
            .attach('file', Buffer.from('not-media'), {
                filename: 'bad.txt',
                contentType: 'text/plain',
            })
            .expect(415);

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: actor.user.id },
            select: { uploadCount: true },
        });
        expect(user.uploadCount).toBe(0);
    });

    it('accepts multipart avatar uploads and keeps avatarKey unchanged on invalid avatars', async () => {
        const actor = await registerUserWithPermissions(app, [
            Permission.USERS_AVATAR_UPDATE_SELF,
        ]);

        await request(app)
            .post('/users/me/avatar')
            .set('Cookie', actor.cookie)
            .attach('avatar', await pngBuffer(), {
                filename: 'avatar.png',
                contentType: 'image/png',
            })
            .expect(200);

        const withAvatar = await prisma.user.findUniqueOrThrow({
            where: { id: actor.user.id },
            select: { avatarKey: true },
        });
        expect(withAvatar.avatarKey).toMatch(/^avatars\/.+\.png$/);

        await request(app)
            .post('/users/me/avatar')
            .set('Cookie', actor.cookie)
            .attach('avatar', Buffer.from('not-image'), {
                filename: 'bad.txt',
                contentType: 'text/plain',
            })
            .expect(415);

        const afterInvalid = await prisma.user.findUniqueOrThrow({
            where: { id: actor.user.id },
            select: { avatarKey: true },
        });
        expect(afterInvalid.avatarKey).toBe(withAvatar.avatarKey);
    });

    it('returns public user JSON normally and admin fields for privileged viewers', async () => {
        const target = await registerUserWithPermissions(app, []);
        const admin = await registerUserWithPermissions(app, [
            Permission.USERS_READ,
            Permission.USERS_READ_PRIVATE,
        ]);

        const publicRes = await request(app)
            .get(`/users/${target.user.id}`)
            .expect(200);

        expect(publicRes.body).toMatchObject({
            id: target.user.id,
            username: target.user.username,
        });
        expect(publicRes.body.email).toBeUndefined();
        expect(publicRes.body.uploadCount).toBeUndefined();

        const adminRes = await request(app)
            .get(`/users/${target.user.id}`)
            .set('Cookie', admin.cookie)
            .expect(200);

        expect(adminRes.body).toMatchObject({
            id: target.user.id,
            email: target.user.email,
            showRatings: true,
            uploadCount: 0,
            warningCount: 0,
            isBanned: false,
        });
        expect(adminRes.body.password).toBeUndefined();
        expect(adminRes.body.roles).toEqual(expect.any(Array));
        expect(adminRes.body.permissions).toEqual(expect.any(Array));
    });

    it('lists user ratings without Prisma createdAt errors', async () => {
        const actor = await registerUserWithPermissions(app, []);
        const media = await createApprovedMediaWithPreview(actor.user.id);

        await prisma.rating.create({
            data: {
                userId: actor.user.id,
                mediaId: media.id,
                value: 8,
            },
        });

        const res = await request(app)
            .get(`/users/${actor.user.id}/ratings`)
            .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({
            value: 8,
            media: { id: media.id },
        });
    });

    it('rejects refresh for deleted users', async () => {
        const body = userPayload('refresh_deleted');
        const registered = await request(app)
            .post('/auth/register')
            .send(body)
            .expect(201);

        await prisma.user.update({
            where: { id: registered.body.user.id },
            data: { deletedAt: new Date() },
        });

        const res = await request(app)
            .post('/auth/refresh')
            .set('Cookie', registered.headers['set-cookie'])
            .expect(401);

        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rate limits auth requests through Redis middleware', async () => {
        for (let i = 0; i < 20; i += 1) {
            await request(app).post('/auth/login').send({}).expect(400);
        }

        const limited = await request(app)
            .post('/auth/login')
            .send({})
            .expect(429);

        expect(limited.body.error.code).toBe('RATE_LIMITED');
    });
});
