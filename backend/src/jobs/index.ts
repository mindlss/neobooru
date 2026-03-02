import type { Job, JobName } from './types';
import { comicRebuildJob } from './jobs/comic_rebuild.job';

export const jobs: Job[] = [comicRebuildJob];

export const jobsByName: Record<JobName, Job> = jobs.reduce(
    (acc, j) => {
        acc[j.name] = j;
        return acc;
    },
    {} as Record<JobName, Job>,
);
