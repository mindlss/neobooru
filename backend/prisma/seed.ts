import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/domain/auth/password.service';
import { env } from '../src/config/env';
import { UserRole } from '@prisma/client';

async function upsertUser(params: {
    email: string;
    username: string;
    password: string;
    role: UserRole;
}) {
    const passwordHash = await hashPassword(params.password);

    return prisma.user.upsert({
        where: { email: params.email },
        update: {
            username: params.username,
            password: passwordHash,
            role: params.role,
            emailVerifiedAt: new Date(),
        },
        create: {
            email: params.email,
            username: params.username,
            password: passwordHash,
            role: params.role,
            emailVerifiedAt: new Date(),
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
    // Убеждаемся, что категория meta есть
    const metaCategory = await prisma.tagCategory.findUnique({
        where: { name: 'meta' },
        select: { id: true },
    });

    if (!metaCategory) {
        throw new Error(
            'Meta category not found. seedTagCategories() must run before seedMetaTags().'
        );
    }

    const autoTags = ['highres', 'animated', 'gif', 'video', 'long', '4k'];

    for (const name of autoTags) {
        await prisma.tag.upsert({
            where: { name },
            update: {
                categoryId: metaCategory.id,
            },
            create: {
                name,
                categoryId: metaCategory.id,
            },
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

    const admin = await upsertUser({
        email: env.SEED_ADMIN_EMAIL,
        username: env.SEED_ADMIN_USERNAME,
        password: env.SEED_ADMIN_PASSWORD,
        role: UserRole.ADMIN,
    });

    const trusted = await upsertUser({
        email: env.SEED_TRUSTED_EMAIL,
        username: env.SEED_TRUSTED_USERNAME,
        password: env.SEED_TRUSTED_PASSWORD,
        role: UserRole.TRUSTED,
    });

    await seedTagCategories();
    await seedMetaTags();
    await seedRoleQuotas();

    console.log('✅ Seed done');
    console.log('Admin:', {
        email: admin.email,
        username: admin.username,
        role: admin.role,
    });
    console.log('Trusted:', {
        email: trusted.email,
        username: trusted.username,
        role: trusted.role,
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
