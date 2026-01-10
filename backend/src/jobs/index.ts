import type { Job, JobName } from './types';
import { quotaResetJob } from './jobs/quota_reset.job';
import { restrictionExpireJob } from './jobs/restriction_expire.job';
import { comicRebuildJob } from './jobs/comic_rebuild.job';

export const jobs: Job[] = [
    quotaResetJob,
    restrictionExpireJob,
    comicRebuildJob,
];

export const jobsByName: Record<JobName, Job> = jobs.reduce((acc, j) => {
    acc[j.name] = j;
    return acc;
}, {} as Record<JobName, Job>);
