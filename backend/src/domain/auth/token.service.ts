import jwt, { type JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { isTokenRevoked } from './tokenBlacklist.service';

type TokenKind = 'access' | 'refresh';

export type VerifiedTokenPayload = JwtPayload & {
    sub: string;
    jti: string;
    exp: number;
    iat: number;
};

function randomJti() {
    return crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex');
}

function signToken(kind: TokenKind, params: { sub: string }) {
    const jti = randomJti();

    const secret = kind === 'access' ? env.JWT_SECRET : env.JWT_REFRESH_SECRET;
    const expiresIn =
        kind === 'access' ? env.JWT_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;

    const token = jwt.sign({}, secret, {
        subject: params.sub,
        jwtid: jti,
        expiresIn,
    });

    return { token, jti };
}

export function signAccessToken(params: { sub: string }) {
    return signToken('access', params).token;
}

export function signRefreshToken(params: { sub: string }) {
    return signToken('refresh', params).token;
}

function decodeAndValidate(raw: string, secret: string): VerifiedTokenPayload {
    const decoded = jwt.verify(raw, secret) as JwtPayload;

    const sub = decoded.sub;
    const jti = decoded.jti;
    const exp = decoded.exp;
    const iat = decoded.iat;

    if (typeof sub !== 'string' || sub.length === 0) {
        throw new Error('JWT_SUB_INVALID');
    }
    if (typeof jti !== 'string' || jti.length === 0) {
        throw new Error('JWT_JTI_INVALID');
    }
    if (typeof exp !== 'number') {
        throw new Error('JWT_EXP_INVALID');
    }
    if (typeof iat !== 'number') {
        throw new Error('JWT_IAT_INVALID');
    }

    return { ...decoded, sub, jti, exp, iat } as VerifiedTokenPayload;
}

export async function verifyAccessToken(
    token: string,
): Promise<VerifiedTokenPayload> {
    const payload = decodeAndValidate(token, env.JWT_SECRET);

    const revoked = await isTokenRevoked({ kind: 'access', jti: payload.jti });
    if (revoked) throw new Error('JWT_REVOKED');

    return payload;
}

export async function verifyRefreshToken(
    token: string,
): Promise<VerifiedTokenPayload> {
    const payload = decodeAndValidate(token, env.JWT_REFRESH_SECRET);

    const revoked = await isTokenRevoked({ kind: 'refresh', jti: payload.jti });
    if (revoked) throw new Error('JWT_REVOKED');

    return payload;
}
