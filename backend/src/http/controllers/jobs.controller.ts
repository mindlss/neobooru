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
import { UserRole } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { runJobNow, getJobsStatus } from '../../jobs/runner';
import type { JobName } from '../../jobs/types';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned, requireRole } from '../tsoa/guards';

import type { JobsListResponseDTO, RunJobResponseDTO } from '../dto/jobs.dto';

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
     * MOD/ADMIN only
     */
    @Get()
    @Security('cookieAuth')
    public async listJobs(
        @Request() req: ExpressRequest,
    ): Promise<JobsListResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        return { data: getJobsStatus(), allowedJobs };
    }

    /**
     * POST /jobs/:name/run
     * MOD/ADMIN only
     */
    @Post('{name}/run')
    @Security('cookieAuth')
    public async runJob(
        @Path() name: string,
        @Request() req: ExpressRequest,
    ): Promise<RunJobResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);
        requireRole(req.viewer!.role, [UserRole.MODERATOR, UserRole.ADMIN]);

        const nameRaw = String(name ?? '');
        if (!isJobName(nameRaw)) {
            throw apiError(400, 'BAD_REQUEST', 'Unknown job name', {
                allowedJobs,
            });
        }

        const userId = req.currentUser!.id;
        const role = req.currentUser!.role;

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

        return { data: { job: nameRaw, result } };
    }
}
