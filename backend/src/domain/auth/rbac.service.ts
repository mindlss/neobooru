import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../lib/prisma';
import { hashPassword } from './password.service';
import { Permission } from './permissions';

export const ADMIN_ROLE_KEY = 'admin';
export const USER_ROLE_KEY = 'user';

export const DEFAULT_USER_PERMISSIONS: Permission[] = [
    Permission.USERS_READ,
    Permission.USERS_UPDATE_SELF,
    Permission.USERS_AVATAR_UPDATE_SELF,

    Permission.MEDIA_UPLOAD,
    Permission.MEDIA_USE_OWN,

    Permission.COMICS_CREATE,
    Permission.COMICS_READ_OWN,
    Permission.COMICS_EDIT_OWN,

    Permission.COMMENTS_READ,
    Permission.COMMENTS_CREATE,
    Permission.COMMENTS_DELETE_OWN,

    Permission.RATINGS_SET,
    Permission.RATINGS_REMOVE,

    Permission.FAVORITES_ADD,
    Permission.FAVORITES_REMOVE,

    Permission.REPORTS_CREATE,

    Permission.MEDIA_TAGS_EDIT_OWN,
];

async function ensurePermission(key: Permission) {
    return prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
    });
}

async function ensureRole(params: {
    key: string;
    name: string;
    description: string;
}) {
    return prisma.role.upsert({
        where: { key: params.key },
        update: {
            name: params.name,
            description: params.description,
            isSystem: true,
        },
        create: {
            key: params.key,
            name: params.name,
            description: params.description,
            isSystem: true,
        },
    });
}

async function setRolePermissions(roleId: string, permissionIds: string[]) {
    const desired = new Set(permissionIds);
    const existing = await prisma.rolePermission.findMany({
        where: { roleId },
        select: { id: true, permissionId: true },
    });

    await prisma.rolePermission.deleteMany({
        where: {
            roleId,
            permissionId: {
                notIn: permissionIds,
            },
        },
    });

    const existingIds = new Set(
        existing
            .filter((row) => desired.has(row.permissionId))
            .map((row) => row.permissionId),
    );

    for (const permissionId of permissionIds) {
        if (existingIds.has(permissionId)) continue;
        await prisma.rolePermission.create({
            data: { roleId, permissionId },
        });
    }
}

export async function assignRoleToUser(params: {
    userId: string;
    roleId: string;
    createdById?: string | null;
}) {
    await prisma.roleAssignment.upsert({
        where: {
            userId_roleId: { userId: params.userId, roleId: params.roleId },
        },
        update: {},
        create: {
            userId: params.userId,
            roleId: params.roleId,
            createdById: params.createdById ?? null,
        },
    });
}

export async function ensureDefaultRolesAndPermissions() {
    const permissions = await Promise.all(
        Object.values(Permission).map((key) => ensurePermission(key)),
    );
    const permissionIdByKey = new Map(
        permissions.map((permission) => [permission.key, permission.id]),
    );

    const adminRole = await ensureRole({
        key: ADMIN_ROLE_KEY,
        name: 'Admin',
        description: 'Full access',
    });
    const userRole = await ensureRole({
        key: USER_ROLE_KEY,
        name: 'User',
        description: 'Regular user',
    });

    await setRolePermissions(
        adminRole.id,
        permissions.map((permission) => permission.id),
    );

    await setRolePermissions(
        userRole.id,
        DEFAULT_USER_PERMISSIONS.map((key) => permissionIdByKey.get(key)).filter(
            (id): id is string => typeof id === 'string',
        ),
    );

    return { adminRole, userRole };
}

export async function ensureFirstAdmin() {
    const { adminRole } = await ensureDefaultRolesAndPermissions();
    const existingAdminAssignment = await prisma.roleAssignment.findFirst({
        where: { roleId: adminRole.id },
        select: { id: true },
    });

    if (existingAdminAssignment) return null;

    let admin = await prisma.user.findUnique({
        where: { email: env.SEED_ADMIN_EMAIL },
    });

    if (!admin) {
        admin = await prisma.user.create({
            data: {
                email: env.SEED_ADMIN_EMAIL,
                username: env.SEED_ADMIN_USERNAME,
                password: await hashPassword(env.SEED_ADMIN_PASSWORD),
                emailVerifiedAt: new Date(),
            },
        });
    } else if (admin.deletedAt) {
        admin = await prisma.user.update({
            where: { id: admin.id },
            data: { deletedAt: null, emailVerifiedAt: new Date() },
        });
    }

    await assignRoleToUser({
        userId: admin.id,
        roleId: adminRole.id,
        createdById: admin.id,
    });

    logger.warn(
        {
            email: admin.email,
            username: admin.username,
        },
        'Created first admin from SEED_ADMIN_* configuration',
    );

    return admin;
}
