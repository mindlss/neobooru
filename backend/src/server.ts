import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';
import { ensureBucket } from './lib/minio';

const app = createApp();

async function start() {
    await ensureBucket();

    const server = app.listen(env.PORT, () => {
        logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
    });

    async function shutdown(signal: string) {
        logger.info({ signal }, 'Shutting down...');
        server.close(async () => {
            try {
                await prisma.$disconnect();
                logger.info('Prisma disconnected');
            } finally {
                process.exit(0);
            }
        });
    }

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
