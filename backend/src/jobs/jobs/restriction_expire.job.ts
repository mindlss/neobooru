import type { Job } from '../types';
import { prisma } from '../../lib/prisma';

export const restrictionExpireJob: Job = {
    name: 'restriction_expire',
    description: 'Deactivate restrictions where expiresAt <= now',
    everyMs: 60_000,
    runOnStart: true,

    async run({ now }) {
        const res = await prisma.restriction.updateMany({
            where: {
                isActive: true,
                expiresAt: { not: null, lte: now },
            },
            data: {
                isActive: false,
                revokedAt: now,
            },
        });

        return { ok: true, stats: { deactivated: res.count } };
    },
};
