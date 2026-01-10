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

    let shuttingDown = false;

    async function shutdown(signal: string) {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info({ signal }, 'Shutting down...');

        // Stop accepting new connections
        server.close(async () => {
            logger.info('HTTP server closed');

            try {
                await prisma.$disconnect();
                logger.info('Prisma disconnected');
            } catch (err) {
                logger.error({ err }, 'Failed to disconnect Prisma');
            } finally {
                // Give streams a moment to flush
                setTimeout(() => process.exit(0), 50).unref();
            }
        });

        // Hard exit fallback
        setTimeout(() => {
            logger.error({ signal }, 'Forced shutdown');
            process.exit(1);
        }, 10_000).unref();
    }

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
