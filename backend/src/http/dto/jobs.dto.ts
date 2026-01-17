import type { JobName } from '../../jobs/types';

export type JobsListResponseDTO = {
    data: unknown;
    allowedJobs: JobName[];
};

export type RunJobParamsDTO = {
    name: string;
};

export type RunJobErrorDTO = {
    error: {
        code: 'BAD_REQUEST' | 'UNAUTHORIZED';
        message: string;
        allowedJobs?: JobName[];
    };
};

export type RunJobResultDTO = {
    ok: boolean;
    message?: string;
    stats?: unknown;
};

export type RunJobResponseDTO = {
    data: {
        job: JobName;
        result: RunJobResultDTO;
    };
};
