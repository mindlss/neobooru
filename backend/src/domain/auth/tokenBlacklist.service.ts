import { redis } from '../../lib/redis';

function nowSec() {
    return Math.floor(Date.now() / 1000);
}

export function blacklistKey(kind: 'access' | 'refresh', jti: string) {
    return `bl:${kind}:${jti}`;
}

export async function revokeToken(params: {
    kind: 'access' | 'refresh';
    jti: string;
    exp: number;
}) {
    const ttl = params.exp - nowSec();
    if (ttl <= 0) return;

    await redis.set(blacklistKey(params.kind, params.jti), '1', 'EX', ttl);
}

export async function isTokenRevoked(params: {
    kind: 'access' | 'refresh';
    jti: string;
}) {
    const v = await redis.get(blacklistKey(params.kind, params.jti));
    return v === '1';
}
