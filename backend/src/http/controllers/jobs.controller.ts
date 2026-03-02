import {
    Controller,
    Get,
    Path,
    Post,
    Request,
    Route,
    Security,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { prisma } from '../../lib/prisma';
import { runJobNow, getJobsStatus } from '../../jobs/runner';
import type { JobName } from '../../jobs/types';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned } from '../tsoa/guards';

import type { JobsListResponseDTO, RunJobResponseDTO } from '../dto/jobs.dto';

import { Permission, Scope } from '../../domain/auth/permissions';

const allowedJobs: JobName[] = [
    'quota_reset',
    'restriction_expire',
    'comic_rebuild',
];

function isJobName(x: string): x is JobName {
    return (allowedJobs as string[]).includes(x);
}

@Route('jobs')
@Tags('Jobs')
export class JobsController extends Controller {
    /**
     * GET /jobs
     */
    @Get()
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.JOBS_RUN])
    public async listJobs(
        @Request() req: ExpressRequest,
    ): Promise<JobsListResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        return { data: getJobsStatus(), allowedJobs };
    }

    /**
     * POST /jobs/:name/run
     */
    @Post('{name}/run')
    @Security('cookieAuth', [Scope.LOAD_PERMISSIONS, Permission.JOBS_RUN])
    public async runJob(
        @Path() name: string,
        @Request() req: ExpressRequest,
    ): Promise<RunJobResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        const nameRaw = String(name ?? '');
        if (!isJobName(nameRaw)) {
            throw apiError(400, 'BAD_REQUEST', 'Unknown job name', {
                allowedJobs,
            });
        }

        const userId = req.currentUser!.id;

        const result = await runJobNow(nameRaw, {
            type: 'manual',
            byUserId: userId,
            byRole: 'permission:' + Permission.JOBS_RUN,
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

        return { data: { job: nameRaw, result } };
    }
}
