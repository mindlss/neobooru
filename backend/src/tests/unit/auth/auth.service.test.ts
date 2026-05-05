import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma, hashPassword, verifyPassword, signAccessToken, signRefreshToken } =
    vi.hoisted(() => ({
        prisma: {
            user: {
                create: vi.fn(),
                findUnique: vi.fn(),
            },
            role: {
                findUnique: vi.fn(),
                create: vi.fn(),
            },
            roleAssignment: {
                upsert: vi.fn(),
            },
        },
        hashPassword: vi.fn(),
        verifyPassword: vi.fn(),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
    }));

vi.mock('../../../lib/prisma', () => ({ prisma }));
vi.mock('../../../domain/auth/password.service', () => ({
    hashPassword,
    verifyPassword,
}));
vi.mock('../../../domain/auth/token.service', () => ({
    signAccessToken,
    signRefreshToken,
}));

import { loginUser, registerUser } from '../../../domain/auth/auth.service';

describe('auth service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hashPassword.mockResolvedValue('hash-1');
        verifyPassword.mockResolvedValue(true);
        signAccessToken.mockReturnValue('access-token');
        signRefreshToken.mockReturnValue('refresh-token');
    });

    it('registers a user, creates missing unverified role, assigns it, and returns tokens', async () => {
        const user = {
            id: 'user-1',
            username: 'alice',
            email: 'alice@example.test',
            password: 'hash-1',
        };
        prisma.user.create.mockResolvedValue(user);
        prisma.role.findUnique.mockResolvedValue(null);
        prisma.role.create.mockResolvedValue({ id: 'role-1', key: 'unverified' });

        await expect(
            registerUser({
                username: 'alice',
                email: 'alice@example.test',
                password: 'secret',
            }),
        ).resolves.toEqual({
            user,
            token: 'access-token',
            refreshToken: 'refresh-token',
        });

        expect(hashPassword).toHaveBeenCalledWith('secret');
        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                username: 'alice',
                email: 'alice@example.test',
                password: 'hash-1',
            },
        });
        expect(prisma.role.create).toHaveBeenCalledWith({
            data: {
                key: 'unverified',
                name: 'Unverified',
                isSystem: true,
                description: 'Auto-created default role',
            },
        });
        expect(prisma.roleAssignment.upsert).toHaveBeenCalledWith({
            where: {
                userId_roleId: { userId: 'user-1', roleId: 'role-1' },
            },
            update: {},
            create: {
                userId: 'user-1',
                roleId: 'role-1',
                createdById: null,
            },
        });
        expect(signAccessToken).toHaveBeenCalledWith({ sub: 'user-1' });
        expect(signRefreshToken).toHaveBeenCalledWith({ sub: 'user-1' });
    });

    it('registers with an existing unverified role', async () => {
        prisma.user.create.mockResolvedValue({ id: 'user-1' });
        prisma.role.findUnique.mockResolvedValue({
            id: 'role-existing',
            key: 'unverified',
        });

        await registerUser({
            username: 'bob',
            email: 'bob@example.test',
            password: 'secret',
        });

        expect(prisma.role.create).not.toHaveBeenCalled();
        expect(prisma.roleAssignment.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId_roleId: {
                        userId: 'user-1',
                        roleId: 'role-existing',
                    },
                },
            }),
        );
    });

    it('logs in with a verified password and returns fresh tokens', async () => {
        const user = {
            id: 'user-1',
            email: 'alice@example.test',
            password: 'hash-1',
        };
        prisma.user.findUnique.mockResolvedValue(user);

        await expect(
            loginUser({ email: 'alice@example.test', password: 'secret' }),
        ).resolves.toEqual({
            user,
            token: 'access-token',
            refreshToken: 'refresh-token',
        });

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'alice@example.test' },
        });
        expect(verifyPassword).toHaveBeenCalledWith('hash-1', 'secret');
        expect(signAccessToken).toHaveBeenCalledWith({ sub: 'user-1' });
        expect(signRefreshToken).toHaveBeenCalledWith({ sub: 'user-1' });
    });

    it('rejects login when user does not exist', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(
            loginUser({ email: 'missing@example.test', password: 'secret' }),
        ).rejects.toMatchObject({
            status: 401,
            code: 'INVALID_CREDENTIALS',
        });
        expect(verifyPassword).not.toHaveBeenCalled();
    });

    it('rejects login when password verification fails', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            password: 'hash-1',
        });
        verifyPassword.mockResolvedValue(false);

        await expect(
            loginUser({ email: 'alice@example.test', password: 'wrong' }),
        ).rejects.toMatchObject({
            status: 401,
            code: 'INVALID_CREDENTIALS',
        });
        expect(signAccessToken).not.toHaveBeenCalled();
        expect(signRefreshToken).not.toHaveBeenCalled();
    });
});
