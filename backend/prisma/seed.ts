import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/domain/auth/password.service';
import { env } from '../src/config/env';
import { UserRole } from '@prisma/client';

function yearsAgo(years: number) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
}

async function upsertUser(params: {
    email: string;
    username: string;
    password: string;
    role: UserRole;
    birthDate?: Date | null;
    bio?: string | null;
    website?: string | null;
    avatarKey?: string | null;
}) {
    const passwordHash = await hashPassword(params.password);
    const now = new Date();

    return prisma.user.upsert({
        where: { email: params.email },
        update: {
            username: params.username,
            password: passwordHash,
            role: params.role,
            emailVerifiedAt: now,
            birthDate: params.birthDate ?? null,
            bio: params.bio ?? null,
            website: params.website ?? null,
            avatarKey: params.avatarKey ?? null,
        },
        create: {
            email: params.email,
            username: params.username,
            password: passwordHash,
            role: params.role,
            emailVerifiedAt: now,
            birthDate: params.birthDate ?? null,
            bio: params.bio ?? null,
            website: params.website ?? null,
            avatarKey: params.avatarKey ?? null,
        },
    });
}

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
        });
    }
}

async function seedMetaTags() {
    const metaCategory = await prisma.tagCategory.findUnique({
        where: { name: 'meta' },
        select: { id: true },
    });

    if (!metaCategory) {
        throw new Error(
            'Meta category not found. seedTagCategories() must run before seedMetaTags().'
        );
    }

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
            update: { categoryId: metaCategory.id },
            create: { name, categoryId: metaCategory.id },
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
        throw new Error('Tag categories missing; run seedTagCategories first');
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
        });
        await prisma.tagAlias.upsert({
            where: { alias: '18+' },
            update: { tagId: nsfw.id },
            create: { alias: '18+', tagId: nsfw.id },
        });
    }

    if (landscape) {
        await prisma.tagAlias.upsert({
            where: { alias: 'scenery' },
            update: { tagId: landscape.id },
            create: { alias: 'scenery', tagId: landscape.id },
        });
    }
}

async function seedRoleQuotas() {
    const quotas = [
        {
            role: UserRole.GUEST,
            quotas: { daily_uploads: 0, max_file_size: 0, total_uploads: 0 },
        },
        {
            role: UserRole.UNVERIFIED,
            quotas: { daily_uploads: 0, max_file_size: 0, total_uploads: 0 },
        },
        {
            role: UserRole.USER,
            quotas: { daily_uploads: 0, max_file_size: 0, total_uploads: 0 },
        },
        {
            role: UserRole.TRUSTED,
            quotas: {
                daily_uploads: 50,
                max_file_size: 104857600,
                total_uploads: 0,
            },
        },
        {
            role: UserRole.MODERATOR,
            quotas: {
                daily_uploads: 200,
                max_file_size: 209715200,
                total_uploads: 0,
            },
        },
        {
            role: UserRole.ADMIN,
            quotas: {
                daily_uploads: 1000,
                max_file_size: 1073741824,
                total_uploads: 0,
            },
        },
    ];

    for (const q of quotas) {
        await prisma.roleQuota.upsert({
            where: { role: q.role },
            update: { quotas: q.quotas },
            create: { role: q.role, quotas: q.quotas },
        });
    }
}

async function main() {
    console.log('🌱 Seeding...');

    await seedTagCategories();
    await seedMetaTags();
    await seedSomeTagsAndAliases();
    await seedRoleQuotas();

    const admin = await upsertUser({
        email: env.SEED_ADMIN_EMAIL,
        username: env.SEED_ADMIN_USERNAME,
        password: env.SEED_ADMIN_PASSWORD,
        role: UserRole.ADMIN,
        birthDate: yearsAgo(25),
        bio: 'Local admin. Can do everything. 🛠️',
        website: 'https://localhost/admin',
        avatarKey: 'avatars/admin.png',
    });

    const moderator = await upsertUser({
        email: 'mod@local.dev',
        username: 'mod',
        password: 'mod12345',
        role: UserRole.MODERATOR,
        birthDate: yearsAgo(30),
        bio: 'Queue enjoyer. Approves things for science.',
        website: 'https://localhost/mod',
        avatarKey: 'avatars/mod.png',
    });

    const trusted = await upsertUser({
        email: env.SEED_TRUSTED_EMAIL,
        username: env.SEED_TRUSTED_USERNAME,
        password: env.SEED_TRUSTED_PASSWORD,
        role: UserRole.TRUSTED,
        birthDate: yearsAgo(22),
        bio: 'Trusted uploader. Has higher quotas.',
        website: 'https://localhost/u/trusted',
        avatarKey: 'avatars/trusted.png',
    });

    const user = await upsertUser({
        email: 'user@local.dev',
        username: 'user',
        password: 'user12345',
        role: UserRole.USER,
        birthDate: yearsAgo(17),
        bio: 'Regular user (minor for explicit checks).',
        website: null,
        avatarKey: null,
    });

    const unverified = await upsertUser({
        email: 'new@local.dev',
        username: 'newbie',
        password: 'newbie12345',
        role: UserRole.UNVERIFIED,
        birthDate: null,
        bio: 'Just registered. Email not verified (role UNVERIFIED).',
        website: null,
        avatarKey: null,
    });

    console.log('✅ Seed done');
    console.log('Users:', [
        {
            email: admin.email,
            username: admin.username,
            role: admin.role,
            birthDate: admin.birthDate,
        },
        {
            email: moderator.email,
            username: moderator.username,
            role: moderator.role,
            birthDate: moderator.birthDate,
        },
        {
            email: trusted.email,
            username: trusted.username,
            role: trusted.role,
            birthDate: trusted.birthDate,
        },
        {
            email: user.email,
            username: user.username,
            role: user.role,
            birthDate: user.birthDate,
        },
        {
            email: unverified.email,
            username: unverified.username,
            role: unverified.role,
            birthDate: unverified.birthDate,
        },
    ]);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
