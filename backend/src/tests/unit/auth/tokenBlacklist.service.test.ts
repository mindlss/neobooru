import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redis } = vi.hoisted(() => ({
    redis: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../lib/redis', () => ({ redis }));

import {
    blacklistKey,
    isTokenRevoked,
    revokeToken,
} from '../../../domain/auth/tokenBlacklist.service';

describe('token blacklist service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('builds stable blacklist keys by kind and jti', () => {
        expect(blacklistKey('access', 'abc')).toBe('bl:access:abc');
        expect(blacklistKey('refresh', 'xyz')).toBe('bl:refresh:xyz');
    });

    it('stores unexpired tokens with ttl until expiration', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(10_000));

        await revokeToken({ kind: 'access', jti: 'jti-1', exp: 25 });

        expect(redis.set).toHaveBeenCalledWith(
            'bl:access:jti-1',
            '1',
            'EX',
            15,
        );
    });

    it('does not store already expired tokens', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));

        await revokeToken({ kind: 'refresh', jti: 'jti-1', exp: 10 });

        expect(redis.set).not.toHaveBeenCalled();
    });

    it('checks revocation by redis value', async () => {
        redis.get.mockResolvedValueOnce('1').mockResolvedValueOnce(null);

        await expect(
            isTokenRevoked({ kind: 'access', jti: 'jti-1' }),
        ).resolves.toBe(true);
        await expect(
            isTokenRevoked({ kind: 'access', jti: 'jti-2' }),
        ).resolves.toBe(false);

        expect(redis.get).toHaveBeenNthCalledWith(1, 'bl:access:jti-1');
        expect(redis.get).toHaveBeenNthCalledWith(2, 'bl:access:jti-2');
    });
});
