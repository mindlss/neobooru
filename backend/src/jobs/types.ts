export type JobName = 'quota_reset' | 'restriction_expire' | 'comic_rebuild';

export type JobTrigger =
    | { type: 'scheduler' }
    | { type: 'manual'; byUserId: string; byRole: string };

export type JobResult = {
    ok: boolean;
    message?: string;
    stats?: Record<string, number>;
};

export type JobContext = {
    now: Date;
    trigger: JobTrigger;
};

export type Job = {
    name: JobName;
    description: string;
    everyMs: number;
    runOnStart?: boolean;
    run(ctx: JobContext): Promise<JobResult>;
};
