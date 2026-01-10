import { z } from 'zod';

export const searchQuerySchema = z.object({
    q: z.string().default(''),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().optional(),
});
