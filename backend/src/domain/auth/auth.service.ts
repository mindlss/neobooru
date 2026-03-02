import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from './password.service';
import { signAccessToken, signRefreshToken } from './token.service';
import { apiError } from '../../http/errors/ApiError';

async function ensureRole(key: string, name: string) {
    const existing = await prisma.role.findUnique({ where: { key } });
    if (existing) return existing;

    return prisma.role.create({
        data: {
            key,
            name,
            isSystem: true,
            description: 'Auto-created default role',
        },
    });
}

async function assignRole(params: {
    userId: string;
    roleId: string;
    createdById?: string | null;
}) {
    await prisma.roleAssignment.upsert({
        where: {
            userId_roleId: { userId: params.userId, roleId: params.roleId },
        },
        update: {},
        create: {
            userId: params.userId,
            roleId: params.roleId,
            createdById: params.createdById ?? null,
        },
    });
}

export async function registerUser(input: {
    username: string;
    email: string;
    password: string;
}) {
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
        data: {
            username: input.username,
            email: input.email,
            password: passwordHash,
        },
    });

    // дефолтная роль для новых аккаунтов
    const unverified = await ensureRole('unverified', 'Unverified');
    await assignRole({
        userId: user.id,
        roleId: unverified.id,
        createdById: null,
    });

    const token = signAccessToken({ sub: user.id });
    const refreshToken = signRefreshToken({ sub: user.id });

    return { user, token, refreshToken };
}

export async function loginUser(input: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
    });

    if (!user) {
        throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const ok = await verifyPassword(user.password, input.password);
    if (!ok) {
        throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const token = signAccessToken({ sub: user.id });
    const refreshToken = signRefreshToken({ sub: user.id });

    return { user, token, refreshToken };
}
