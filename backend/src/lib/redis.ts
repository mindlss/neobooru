import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});
