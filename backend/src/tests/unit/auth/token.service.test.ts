import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../../config/env';

const { isTokenRevoked } = vi.hoisted(() => ({
    isTokenRevoked: vi.fn(),
}));

vi.mock('../../../domain/auth/tokenBlacklist.service', () => ({
    isTokenRevoked,
}));

import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
} from '../../../domain/auth/token.service';

describe('token service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTokenRevoked.mockResolvedValue(false);
    });

    it('signs access tokens with subject, jti, exp, and iat', async () => {
        const token = signAccessToken({ sub: 'user-1' });
        const payload = await verifyAccessToken(token);

        expect(payload.sub).toBe('user-1');
        expect(payload.jti).toEqual(expect.any(String));
        expect(payload.exp).toEqual(expect.any(Number));
        expect(payload.iat).toEqual(expect.any(Number));
        expect(isTokenRevoked).toHaveBeenCalledWith({
            kind: 'access',
            jti: payload.jti,
        });
    });

    it('signs refresh tokens with the refresh secret', async () => {
        const token = signRefreshToken({ sub: 'user-2' });

        expect(() => jwt.verify(token, env.JWT_SECRET)).toThrow();

        const payload = await verifyRefreshToken(token);
        expect(payload.sub).toBe('user-2');
        expect(isTokenRevoked).toHaveBeenCalledWith({
            kind: 'refresh',
            jti: payload.jti,
        });
    });

    it('rejects revoked tokens', async () => {
        isTokenRevoked.mockResolvedValue(true);

        await expect(
            verifyAccessToken(signAccessToken({ sub: 'user-1' })),
        ).rejects.toThrow('JWT_REVOKED');
        await expect(
            verifyRefreshToken(signRefreshToken({ sub: 'user-1' })),
        ).rejects.toThrow('JWT_REVOKED');
    });

    it('rejects payloads without a valid subject or jti', async () => {
        const noSubject = jwt.sign({}, env.JWT_SECRET, {
            jwtid: 'jti-1',
            expiresIn: 60,
        });
        const noJti = jwt.sign({}, env.JWT_SECRET, {
            subject: 'user-1',
            expiresIn: 60,
        });

        await expect(verifyAccessToken(noSubject)).rejects.toThrow(
            'JWT_SUB_INVALID',
        );
        await expect(verifyAccessToken(noJti)).rejects.toThrow(
            'JWT_JTI_INVALID',
        );
    });

    it('rejects tokens signed with the wrong secret', async () => {
        await expect(
            verifyAccessToken(signRefreshToken({ sub: 'user-1' })),
        ).rejects.toThrow();
        await expect(
            verifyRefreshToken(signAccessToken({ sub: 'user-1' })),
        ).rejects.toThrow();
    });
});
