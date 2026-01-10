import type { Request, Response } from 'express';
import { runJobNow, getJobsStatus } from '../../jobs/runner';
import type { JobName } from '../../jobs/types';
import { prisma } from '../../lib/prisma';

const allowedJobs: JobName[] = [
    'quota_reset',
    'restriction_expire',
    'comic_rebuild',
];

function isJobName(x: string): x is JobName {
    return (allowedJobs as string[]).includes(x);
}

export async function listJobs(_req: Request, res: Response) {
    return res.json({ data: getJobsStatus(), allowedJobs });
}

export async function runJob(req: Request, res: Response) {
    const nameRaw = String(req.params.name ?? '');
    if (!isJobName(nameRaw)) {
        return res.status(400).json({
            error: {
                code: 'BAD_REQUEST',
                message: 'Unknown job name',
                allowedJobs,
            },
        });
    }

    const userId = req.currentUser?.id ?? req.user?.id;
    const role = req.currentUser?.role ?? req.user?.role;

    if (!userId || !role) {
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Missing auth' },
        });
    }

    const result = await runJobNow(nameRaw, {
        type: 'manual',
        byUserId: userId,
        byRole: String(role),
    });

    await prisma.moderationLog.create({
        data: {
            action: 'JOB_RUN',
            targetType: 'JOB',
            targetId: nameRaw,
            moderatorId: userId,
            details: {
                job: nameRaw,
                ok: result.ok,
                message: result.message ?? null,
                stats: result.stats ?? null,
            },
        },
    });

    return res.json({ data: { job: nameRaw, result } });
}
