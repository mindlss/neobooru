import { z } from 'zod';

export const commentsListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid().optional(),
    sort: z.enum(['new', 'old']).default('old'),
});

export const createCommentSchema = z.object({
    content: z.string().trim().min(1).max(5000),
    parentId: z.string().uuid().nullable().optional(),
});

export const deleteCommentSchema = z.object({
    reason: z.string().trim().min(1).max(2000).optional(),
});
