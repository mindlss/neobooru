import { logger } from '../config/logger';
import { env } from '../config/env';
import { jobsByName, jobs } from './index';
import type { JobName, JobTrigger, JobResult } from './types';

type JobState = {
    lastStartedAt?: Date;
    lastFinishedAt?: Date;
    lastResult?: JobResult;
    lastError?: unknown;
    running: boolean;
};

const state: Record<JobName, JobState> = {
    quota_reset: { running: false },
    restriction_expire: { running: false },
    comic_rebuild: { running: false },
};

let intervalRef: NodeJS.Timeout | null = null;

async function runJobInternal(
    name: JobName,
    trigger: JobTrigger
): Promise<JobResult> {
    const job = jobsByName[name];
    const st = state[name];

    if (st.running) {
        return { ok: true, message: 'Already running (skipped)' };
    }

    st.running = true;
    st.lastStartedAt = new Date();
    st.lastError = undefined;

    const now = new Date();
    const t0 = Date.now();

    logger.info({ job: name, trigger }, 'Job started');

    try {
        const result = await job.run({ now, trigger });
        st.lastResult = result;
        st.lastFinishedAt = new Date();

        logger.info(
            {
                job: name,
                ok: result.ok,
                ms: Date.now() - t0,
                stats: result.stats,
            },
            'Job finished'
        );

        return result;
    } catch (err) {
        st.lastError = err;
        st.lastResult = { ok: false, message: 'Unhandled error' };
        st.lastFinishedAt = new Date();

        logger.error({ job: name, err, ms: Date.now() - t0 }, 'Job failed');
        return { ok: false, message: 'Unhandled error' };
    } finally {
        st.running = false;
    }
}

export function getJobsStatus() {
    return Object.entries(state).map(([name, st]) => ({
        name,
        running: st.running,
        lastStartedAt: st.lastStartedAt ?? null,
        lastFinishedAt: st.lastFinishedAt ?? null,
        lastResult: st.lastResult ?? null,
    }));
}

export async function runJobNow(name: JobName, trigger: JobTrigger) {
    return runJobInternal(name, trigger);
}

export function startJobsRunner() {
    if (env.NODE_ENV === 'test') {
        logger.info('Jobs runner disabled in test env');
        return;
    }
    if (env.JOBS_ENABLED !== 'true') {
        logger.info('Jobs runner disabled by JOBS_ENABLED');
        return;
    }
    if (intervalRef) return;

    const tickMs = env.JOBS_TICK_MS;

    const tick = async () => {
        const now = new Date();

        for (const job of jobs) {
            const st = state[job.name];

            const last = st.lastStartedAt?.getTime() ?? 0;
            const due = now.getTime() - last >= job.everyMs;

            if (!due) continue;
            if (st.running) continue;

            void runJobInternal(job.name, { type: 'scheduler' });
        }
    };

    intervalRef = setInterval(tick, tickMs);
    intervalRef.unref();

    logger.info({ tickMs }, 'Jobs runner started');

    if (env.JOBS_RUN_ON_START === 'true') {
        for (const job of jobs) {
            if (!job.runOnStart) continue;
            void runJobInternal(job.name, { type: 'scheduler' });
        }
    }
}

export function stopJobsRunner() {
    if (!intervalRef) return;
    clearInterval(intervalRef);
    intervalRef = null;
    logger.info('Jobs runner stopped');
}
