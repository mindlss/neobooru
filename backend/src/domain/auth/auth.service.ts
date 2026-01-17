import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from './password.service';
import { signAccessToken, signRefreshToken } from './token.service';
import { UserRole } from '@prisma/client';
import { apiError } from '../../http/errors/ApiError';

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
            role: UserRole.UNVERIFIED,
        },
    });

    const token = signAccessToken({
        sub: user.id,
        role: user.role,
    });

    const refreshToken = signRefreshToken({
        sub: user.id,
        role: user.role,
    });

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

    const token = signAccessToken({
        sub: user.id,
        role: user.role,
    });

    const refreshToken = signRefreshToken({
        sub: user.id,
        role: user.role,
    });

    return { user, token, refreshToken };
}
