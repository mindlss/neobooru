import { z } from 'zod';

export const queueQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().uuid().optional(),
});

export const moderationActionSchema = z.object({
    notes: z.string().max(2000).optional(),
});
