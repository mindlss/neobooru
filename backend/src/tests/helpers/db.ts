import { prisma } from '../../lib/prisma';

function quoteIdent(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
}

export async function resetDatabase() {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
    `;

    if (!tables.length) return;

    const tableNames = tables
        .map(({ tablename }) => `public.${quoteIdent(tablename)}`)
        .join(', ');

    await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
    );
}
