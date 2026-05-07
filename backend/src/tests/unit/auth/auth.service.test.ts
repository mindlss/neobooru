import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma, hashPassword, verifyPassword, signAccessToken, signRefreshToken } =
    vi.hoisted(() => ({
        prisma: {
            user: {
                create: vi.fn(),
                findUnique: vi.fn(),
            },
        },
        hashPassword: vi.fn(),
        verifyPassword: vi.fn(),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
    }));

const { ensureDefaultRolesAndPermissions, assignRoleToUser } = vi.hoisted(() => ({
    ensureDefaultRolesAndPermissions: vi.fn(),
    assignRoleToUser: vi.fn(),
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
vi.mock('../../../domain/auth/rbac.service', () => ({
    ensureDefaultRolesAndPermissions,
    assignRoleToUser,
}));

import { loginUser, registerUser } from '../../../domain/auth/auth.service';

describe('auth service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hashPassword.mockResolvedValue('hash-1');
        verifyPassword.mockResolvedValue(true);
        signAccessToken.mockReturnValue('access-token');
        signRefreshToken.mockReturnValue('refresh-token');
        ensureDefaultRolesAndPermissions.mockResolvedValue({
            userRole: { id: 'role-user', key: 'user' },
        });
    });

    it('registers a user, assigns the default user role, and returns tokens', async () => {
        const user = {
            id: 'user-1',
            username: 'alice',
            email: 'alice@example.test',
            password: 'hash-1',
        };
        prisma.user.create.mockResolvedValue(user);

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
        expect(ensureDefaultRolesAndPermissions).toHaveBeenCalled();
        expect(assignRoleToUser).toHaveBeenCalledWith({
            userId: 'user-1',
            roleId: 'role-user',
            createdById: null,
        });
        expect(signAccessToken).toHaveBeenCalledWith({ sub: 'user-1' });
        expect(signRefreshToken).toHaveBeenCalledWith({ sub: 'user-1' });
    });

    it('registers with an existing default user role', async () => {
        prisma.user.create.mockResolvedValue({ id: 'user-1' });
        ensureDefaultRolesAndPermissions.mockResolvedValue({
            adminRole: { id: 'role-admin', key: 'admin' },
            userRole: {
                id: 'role-existing',
                key: 'user',
            },
        });

        await registerUser({
            username: 'bob',
            email: 'bob@example.test',
            password: 'secret',
        });

        expect(assignRoleToUser).toHaveBeenCalledWith({
            userId: 'user-1',
            roleId: 'role-existing',
            createdById: null,
        });
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
