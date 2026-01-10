import { z } from 'zod';

export const createReportSchema = z.object({
    type: z.enum(['media', 'comment']),
    targetId: z.string().uuid(),
    reason: z.string().min(1).max(64),
    description: z.string().max(2000).optional(),
});

export const adminReportsListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().uuid().optional(),
    status: z.enum(['pending', 'reviewing', 'resolved', 'rejected']).optional(),
    type: z.enum(['media', 'comment']).optional(),
});

export const adminReportPatchSchema = z.object({
    status: z.enum(['pending', 'reviewing', 'resolved', 'rejected']),
    assignedToId: z.string().uuid().nullable().optional(),
});
