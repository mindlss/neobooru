import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/domain/auth/password.service';
import { env } from '../src/config/env';
import { Permission } from '../src/domain/auth/permissions';

// -------------------- helpers --------------------

function yearsAgo(years: number) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
}

function nowIso() {
    return new Date();
}

async function upsertPermission(key: string, description?: string | null) {
    return prisma.permission.upsert({
        where: { key },
        update: { description: description ?? null },
        create: { key, description: description ?? null },
        select: { id: true, key: true },
    });
}

async function upsertRole(params: {
    key: string;
    name: string;
    description?: string | null;
    isSystem?: boolean;
}) {
    return prisma.role.upsert({
        where: { key: params.key },
        update: {
            name: params.name,
            description: params.description ?? null,
            isSystem: params.isSystem ?? true,
        },
        create: {
            key: params.key,
            name: params.name,
            description: params.description ?? null,
            isSystem: params.isSystem ?? true,
        },
        select: { id: true, key: true },
    });
}

async function setRolePermissions(roleId: string, permissionIds: string[]) {
    await prisma.rolePermission.deleteMany({
        where: {
            roleId,
            permissionId: { notIn: permissionIds },
        },
    });

    await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
    });
}

async function upsertUser(params: {
    email: string;
    username: string;
    password: string;
    birthDate?: Date | null;
    bio?: string | null;
    website?: string | null;
    avatarKey?: string | null;
    emailVerified?: boolean;
    deleted?: boolean;
}) {
    const passwordHash = await hashPassword(params.password);
    const now = nowIso();

    return prisma.user.upsert({
        where: { email: params.email },
        update: {
            username: params.username,
            password: passwordHash,
            birthDate: params.birthDate ?? null,
            bio: params.bio ?? null,
            website: params.website ?? null,
            avatarKey: params.avatarKey ?? null,
            emailVerifiedAt: params.emailVerified === false ? null : now,
            deletedAt: params.deleted ? now : null,
        },
        create: {
            email: params.email,
            username: params.username,
            password: passwordHash,
            birthDate: params.birthDate ?? null,
            bio: params.bio ?? null,
            website: params.website ?? null,
            avatarKey: params.avatarKey ?? null,
            emailVerifiedAt: params.emailVerified === false ? null : now,
            deletedAt: params.deleted ? now : null,
        },
        select: { id: true, email: true, username: true, deletedAt: true },
    });
}

async function assignRole(params: {
    userId: string;
    roleId: string;
    createdById?: string | null;
}) {
    const existing = await prisma.roleAssignment.findFirst({
        where: { userId: params.userId, roleId: params.roleId },
        select: { id: true },
    });

    if (existing) {
        return existing;
    }

    return prisma.roleAssignment.create({
        data: {
            userId: params.userId,
            roleId: params.roleId,
            createdById: params.createdById ?? null,
        },
        select: { id: true },
    });
}

// -------------------- tags seed --------------------

async function seedTagCategories() {
    const defaults = [
        { name: 'general', color: '#9CA3AF' },
        { name: 'artist', color: '#F59E0B' },
        { name: 'copyright', color: '#EF4444' },
        { name: 'character', color: '#22C55E' },
        { name: 'meta', color: '#3B82F6' },
    ];

    for (const c of defaults) {
        await prisma.tagCategory.upsert({
            where: { name: c.name },
            update: { color: c.color },
            create: c,
            select: { id: true },
        });
    }
}

async function seedMetaTags() {
    const meta = await prisma.tagCategory.findUnique({
        where: { name: 'meta' },
        select: { id: true },
    });
    if (!meta) throw new Error('META_CATEGORY_MISSING');

    const metaTags = [
        'highres',
        'animated',
        'gif',
        'video',
        'long',
        '4k',
        'comic_page',
        'comic',
    ];

    for (const name of metaTags) {
        await prisma.tag.upsert({
            where: { name },
            update: { categoryId: meta.id },
            create: { name, categoryId: meta.id },
            select: { id: true },
        });
    }
}

async function seedSomeTagsAndAliases() {
    const general = await prisma.tagCategory.findUnique({
        where: { name: 'general' },
        select: { id: true },
    });
    const artist = await prisma.tagCategory.findUnique({
        where: { name: 'artist' },
        select: { id: true },
    });
    const character = await prisma.tagCategory.findUnique({
        where: { name: 'character' },
        select: { id: true },
    });
    const copyright = await prisma.tagCategory.findUnique({
        where: { name: 'copyright' },
        select: { id: true },
    });

    if (!general || !artist || !character || !copyright) {
        throw new Error('TAG_CATEGORIES_MISSING');
    }

    const tags: Array<{
        name: string;
        categoryId: string;
        isExplicit?: boolean;
    }> = [
        { name: 'landscape', categoryId: general.id },
        { name: 'portrait', categoryId: general.id },
        { name: 'night', categoryId: general.id },
        { name: 'neon', categoryId: general.id },
        { name: 'robot', categoryId: general.id },
        { name: 'cat', categoryId: general.id },
        { name: 'nsfw', categoryId: general.id, isExplicit: true },
        { name: 'john_doe', categoryId: artist.id },
        { name: 'disney', categoryId: copyright.id },
        { name: 'alice', categoryId: character.id },
    ];

    for (const t of tags) {
        await prisma.tag.upsert({
            where: { name: t.name },
            update: {
                categoryId: t.categoryId,
                ...(t.isExplicit !== undefined
                    ? { isExplicit: t.isExplicit }
                    : {}),
            },
            create: {
                name: t.name,
                categoryId: t.categoryId,
                ...(t.isExplicit !== undefined
                    ? { isExplicit: t.isExplicit }
                    : {}),
            },
            select: { id: true },
        });
    }

    const nsfw = await prisma.tag.findUnique({
        where: { name: 'nsfw' },
        select: { id: true },
    });
    const landscape = await prisma.tag.findUnique({
        where: { name: 'landscape' },
        select: { id: true },
    });

    if (nsfw) {
        await prisma.tagAlias.upsert({
            where: { alias: 'explicit' },
            update: { tagId: nsfw.id },
            create: { alias: 'explicit', tagId: nsfw.id },
            select: { id: true },
        });
        await prisma.tagAlias.upsert({
            where: { alias: '18+' },
            update: { tagId: nsfw.id },
            create: { alias: '18+', tagId: nsfw.id },
            select: { id: true },
        });
    }

    if (landscape) {
        await prisma.tagAlias.upsert({
            where: { alias: 'scenery' },
            update: { tagId: landscape.id },
            create: { alias: 'scenery', tagId: landscape.id },
            select: { id: true },
        });
    }
}

// -------------------- RBAC seed --------------------

type SeedPermissionRow = { id: string; key: string };

async function seedPermissions(): Promise<SeedPermissionRow[]> {
    const keys = Object.values(Permission) as string[];

    const rows: SeedPermissionRow[] = [];
    for (const key of keys) {
        rows.push(await upsertPermission(key));
    }

    return rows;
}

async function seedRolesAndGrants(
    allPerms: Array<{ id: string; key: string }>,
) {
    const adminRole = await upsertRole({
        key: 'admin',
        name: 'Admin',
        description: 'Full access',
        isSystem: true,
    });

    const userRole = await upsertRole({
        key: 'user',
        name: 'User',
        description: 'Regular user',
        isSystem: true,
    });

    const permIdByKey = new Map(allPerms.map((p) => [p.key, p.id]));

    await setRolePermissions(
        adminRole.id,
        allPerms.map((p) => p.id),
    );

    const userPermKeys: string[] = [
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

    const userPermIds = userPermKeys
        .map((k) => permIdByKey.get(k))
        .filter((x): x is string => !!x);

    await setRolePermissions(userRole.id, userPermIds);

    return { adminRole, userRole };
}

// -------------------- main --------------------

async function main() {
    console.log('🌱 Seeding...');

    // RBAC
    const perms = await seedPermissions();
    const { adminRole, userRole } = await seedRolesAndGrants(perms);

    // Tags
    await seedTagCategories();
    await seedMetaTags();
    await seedSomeTagsAndAliases();

    // Users
    const admin = await upsertUser({
        email: env.SEED_ADMIN_EMAIL,
        username: env.SEED_ADMIN_USERNAME,
        password: env.SEED_ADMIN_PASSWORD,
        birthDate: yearsAgo(25),
        bio: 'Local admin. Full access.',
        website: 'https://localhost/admin',
        avatarKey: 'avatars/admin.png',
        emailVerified: true,
        deleted: false,
    });

    const user = await upsertUser({
        email: env.SEED_USER_EMAIL,
        username: env.SEED_USER_USERNAME,
        password: env.SEED_USER_PASSWORD,
        birthDate: yearsAgo(17),
        bio: 'Regular user',
        website: null,
        avatarKey: null,
        emailVerified: true,
        deleted: false,
    });

    const deleted = await upsertUser({
        email: env.SEED_DELETED_EMAIL,
        username: env.SEED_DELETED_USERNAME,
        password: env.SEED_DELETED_PASSWORD,
        birthDate: yearsAgo(30),
        bio: 'Soft-deleted account for tests.',
        website: null,
        avatarKey: null,
        emailVerified: true,
        deleted: true,
    });

    // Role assignments
    await assignRole({
        userId: admin.id,
        roleId: adminRole.id,
        createdById: admin.id,
    });

    await assignRole({
        userId: user.id,
        roleId: userRole.id,
        createdById: admin.id,
    });

    await assignRole({
        userId: deleted.id,
        roleId: userRole.id,
        createdById: admin.id,
    });

    if (env.SEED_DEV_USERS === 'true') {
        const mod = await upsertUser({
            email: 'mod@local.dev',
            username: 'mod',
            password: 'mod12345',
            birthDate: yearsAgo(30),
            bio: 'Dev moderator',
            website: null,
            avatarKey: null,
            emailVerified: true,
            deleted: false,
        });

        const moderatorRole = await upsertRole({
            key: 'moderator',
            name: 'Moderator',
            description: 'Moderation/staff role',
            isSystem: true,
        });

        const permIdByKey = new Map(perms.map((p) => [p.key, p.id]));
        const moderatorPermKeys: string[] = [
            Permission.USERS_READ,
            Permission.USERS_READ_DELETED,
            Permission.USERS_READ_PRIVATE,
            Permission.USERS_BAN,
            Permission.ROLES_ASSIGN,

            Permission.MEDIA_READ_DELETED,
            Permission.MEDIA_READ_UNMODERATED,
            Permission.MEDIA_READ_EXPLICIT,
            Permission.MEDIA_USE_ANY,

            Permission.COMICS_READ_ANY,
            Permission.COMICS_EDIT_ANY,

            Permission.COMMENTS_READ,
            Permission.COMMENTS_READ_DELETION_REASON,
            Permission.COMMENTS_DELETE_ANY,

            Permission.MODERATION_QUEUE_READ,
            Permission.MODERATION_MEDIA_APPROVE,
            Permission.MODERATION_MEDIA_REJECT,

            Permission.REPORTS_ADMIN_READ,
            Permission.REPORTS_ADMIN_UPDATE,

            Permission.JOBS_RUN,

            Permission.TAGS_MANAGE,
            Permission.TAGS_ALIASES_MANAGE,

            Permission.MEDIA_TAGS_EDIT_ANY,
        ];

        const moderatorPermIds = moderatorPermKeys
            .map((k) => permIdByKey.get(k))
            .filter((x): x is string => !!x);

        await setRolePermissions(moderatorRole.id, moderatorPermIds);

        await assignRole({
            userId: mod.id,
            roleId: moderatorRole.id,
            createdById: admin.id,
        });
    }

    console.log('✅ Seed done');
    console.log('Admin:', { email: admin.email, username: admin.username });
    console.log('User:', { email: user.email, username: user.username });
    console.log('Deleted:', {
        email: deleted.email,
        username: deleted.username,
    });
}

main()
    .catch((e) => {
        console.error('❌ Seed failed', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
