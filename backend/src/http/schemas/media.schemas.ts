import { z } from 'zod';

export const mediaListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().uuid().optional(),
    sort: z.enum(['new', 'old']).default('new'),
    type: z.enum(['IMAGE', 'VIDEO']).optional(),
});
