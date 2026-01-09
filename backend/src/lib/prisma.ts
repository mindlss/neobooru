import { PrismaClient } from '@prisma/client';

declare global {
    var __prisma: PrismaClient | undefined;
}

export const prisma =
    global.__prisma ??
    new PrismaClient({
        log: ['warn', 'error'],
    });

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}
