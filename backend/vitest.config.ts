import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/tests/setup.ts'],
        globalSetup: ['./src/tests/globalSetup.ts'],
        // Singletons (prisma/redis/minio) шарятся по тестам -> один процесс.
        pool: 'forks',
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 15_000,
        hookTimeout: 30_000,
        include: ['src/tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/domain/**', 'src/utils/**'],
            exclude: ['src/generated/**', 'src/tests/**'],
        },
    },
});
