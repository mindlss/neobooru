import type { Job } from '../types';
import { prisma } from '../../lib/prisma';

function parseInterval(
    input: string
): { value: number; unit: 's' | 'm' | 'h' | 'd' | 'M' } | null {
    const m = /^(\d+)([smhdM])$/.exec(input);
    if (!m) return null;

    const value = Number(m[1]);
    if (!Number.isFinite(value) || value <= 0) return null;

    return { value, unit: m[2] as any };
}

function addIntervalOnce(base: Date, interval: string): Date | null {
    const parsed = parseInterval(interval);
    if (!parsed) return null;

    const d = new Date(base);

    switch (parsed.unit) {
        case 's':
            d.setSeconds(d.getSeconds() + parsed.value);
            return d;
        case 'm':
            d.setMinutes(d.getMinutes() + parsed.value);
            return d;
        case 'h':
            d.setHours(d.getHours() + parsed.value);
            return d;
        case 'd':
            d.setDate(d.getDate() + parsed.value);
            return d;
        case 'M':
            d.setMonth(d.getMonth() + parsed.value);
            return d;
        default:
            return null;
    }
}

function advanceUntilAfterNow(
    prevNextResetAt: Date,
    interval: string,
    now: Date
): Date | null {
    if (!parseInterval(interval)) return null;

    let next = new Date(prevNextResetAt);

    const MAX_STEPS = 10_000;

    for (let i = 0; i < MAX_STEPS; i++) {
        if (next > now) return next;

        const bumped = addIntervalOnce(next, interval);
        if (!bumped) return null;

        if (bumped.getTime() === next.getTime()) return null;

        next = bumped;
    }

    return null;
}

export const quotaResetJob: Job = {
    name: 'quota_reset',
    description:
        'Reset UserQuota where nextResetAt <= now and compute nextResetAt (> now)',
    everyMs: 60_000,
    runOnStart: true,

    async run({ now }) {
        const baseStats = {
            expiredFound: 0,
            touched: 0,
            groups: 0,
            invalidInterval: 0,
        };

        const expired = await prisma.userQuota.findMany({
            where: {
                nextResetAt: { not: null, lte: now },
            },
            select: {
                id: true,
                resetInterval: true,
                nextResetAt: true,
            },
        });

        if (expired.length === 0) {
            return { ok: true, stats: baseStats };
        }

        let touched = 0;
        let invalidInterval = 0;

        const intervalSet = new Set<string>();

        await prisma.$transaction(async (tx) => {
            for (const q of expired) {
                const interval = q.resetInterval ?? '';
                if (interval) intervalSet.add(interval);

                if (!interval || !q.nextResetAt) {
                    invalidInterval++;
                    const res = await tx.userQuota.update({
                        where: { id: q.id },
                        data: { currentValue: 0, nextResetAt: null },
                        select: { id: true },
                    });
                    if (res?.id) touched++;
                    continue;
                }

                const next = advanceUntilAfterNow(q.nextResetAt, interval, now);

                if (!next) {
                    invalidInterval++;
                    const res = await tx.userQuota.update({
                        where: { id: q.id },
                        data: { currentValue: 0, nextResetAt: null },
                        select: { id: true },
                    });
                    if (res?.id) touched++;
                    continue;
                }

                const res = await tx.userQuota.update({
                    where: { id: q.id },
                    data: { currentValue: 0, nextResetAt: next },
                    select: { id: true },
                });
                if (res?.id) touched++;
            }
        });

        return {
            ok: true,
            stats: {
                ...baseStats,
                expiredFound: expired.length,
                touched,
                groups: intervalSet.size + 1,
                invalidInterval,
            },
        };
    },
};
