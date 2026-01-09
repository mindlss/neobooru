import { z } from 'zod';

export const tagNamesSchema = z.object({
    tags: z.array(z.string().min(1).max(64)).min(1).max(200),
});

export const tagSearchSchema = z.object({
    q: z.string().min(1).max(64),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createTagSchema = z.object({
    name: z.string().min(1).max(64),
    categoryId: z.string().uuid(),
});
