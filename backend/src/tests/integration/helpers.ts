import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { MediaType, ModerationStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import type { Permission } from '../../domain/auth/permissions';

export function uniqueSuffix() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function userPayload(prefix = 'user') {
    const suffix = uniqueSuffix();
    return {
        username: `${prefix}_${suffix}`.slice(0, 32),
        email: `${prefix}_${suffix}@example.test`,
        password: 'password123',
    };
}

export async function grantPermissions(userId: string, permissions: Permission[]) {
    const role = await prisma.role.create({
        data: {
            key: `test-role-${randomUUID()}`,
            name: 'Test role',
            isSystem: false,
        },
    });

    for (const key of permissions) {
        const permission = await prisma.permission.upsert({
            where: { key },
            update: {},
            create: { key },
        });

        await prisma.rolePermission.create({
            data: {
                roleId: role.id,
                permissionId: permission.id,
            },
        });
    }

    await prisma.roleAssignment.create({
        data: {
            userId,
            roleId: role.id,
        },
    });

    return role;
}

export async function registerUserWithPermissions(
    app: Express,
    permissions: Permission[],
    prefix = 'user',
) {
    const body = userPayload(prefix);
    const res = await request(app).post('/auth/register').send(body).expect(201);
    await grantPermissions(res.body.user.id, permissions);

    const rawCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(rawCookie) ? rawCookie : [rawCookie];

    return {
        user: res.body.user as { id: string; username: string; email: string },
        cookie: cookie.filter((v): v is string => typeof v === 'string'),
        credentials: body,
    };
}

export async function ensureGeneralCategory() {
    return prisma.tagCategory.upsert({
        where: { name: 'general' },
        update: {},
        create: {
            name: 'general',
            color: '#999999',
        },
    });
}

export async function createApprovedMedia(uploadedById?: string | null) {
    return prisma.media.create({
        data: {
            originalKey: `original/${randomUUID()}.png`,
            hash: randomUUID(),
            contentType: 'image/png',
            size: 1234,
            width: 800,
            height: 600,
            type: MediaType.IMAGE,
            moderationStatus: ModerationStatus.APPROVED,
            uploadedById: uploadedById ?? null,
        },
    });
}

export async function createTag(params: {
    name: string;
    usageCount?: number;
    isExplicit?: boolean;
    customColor?: string | null;
}) {
    const category = await ensureGeneralCategory();

    return prisma.tag.create({
        data: {
            name: params.name,
            usageCount: params.usageCount ?? 0,
            isExplicit: params.isExplicit ?? false,
            customColor: params.customColor ?? null,
            categoryId: category.id,
        },
    });
}
