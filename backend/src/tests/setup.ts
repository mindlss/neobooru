import { afterAll, beforeEach, expect, vi } from 'vitest';

import { resetDatabase } from './helpers/db';
import { prisma } from '../lib/prisma';

const { revokedTokens } = vi.hoisted(() => ({
    revokedTokens: new Map<string, string>(),
}));

vi.mock('../lib/redis', () => ({
    redis: {
        async get(key: string) {
            return revokedTokens.get(key) ?? null;
        },
        async set(key: string, value: string) {
            revokedTokens.set(key, value);
            return 'OK';
        },
        async del(key: string) {
            return revokedTokens.delete(key) ? 1 : 0;
        },
        async flushdb() {
            revokedTokens.clear();
            return 'OK';
        },
        disconnect() {},
        quit: async () => 'OK',
    },
}));

beforeEach(async () => {
    revokedTokens.clear();
    const testPath = expect.getState().testPath ?? '';
    if (testPath.includes('/src/tests/unit/')) return;

    await resetDatabase();
});

afterAll(async () => {
    await prisma.$disconnect();
});
