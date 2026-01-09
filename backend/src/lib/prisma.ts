import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

export const prisma =
    global.__prisma ??
    new PrismaClient({
        log: [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
        ],
    });

type PrismaLogEvent = {
    timestamp: Date;
    message: string;
    target: string;
};

prisma.$on('error', (e: unknown) => {
    const event = e as PrismaLogEvent;

    logger.error(
        {
            message: event.message,
            target: event.target,
            timestamp: event.timestamp,
        },
        'Prisma error'
    );
});

prisma.$on('warn', (e: unknown) => {
    const event = e as PrismaLogEvent;

    logger.warn(
        {
            message: event.message,
            target: event.target,
            timestamp: event.timestamp,
        },
        'Prisma warn'
    );
});

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}
