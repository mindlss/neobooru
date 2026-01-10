import { z } from 'zod';

export const comicIdParamsSchema = z.object({
    id: z.string().uuid(),
});

export const createComicBodySchema = z.object({
    title: z.string().min(1).max(200),
});

export const updateComicBodySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    status: z.enum(['WIP', 'FINISHED', 'DEAD']).optional(),
    coverMediaId: z.string().uuid().nullable().optional(),
});

export const addPageBodySchema = z.object({
    mediaId: z.string().uuid(),
    position: z.coerce.number().int().min(1).optional(),
});

export const removePageParamsSchema = z.object({
    id: z.string().uuid(),
    mediaId: z.string().uuid(),
});

export const reorderPagesBodySchema = z.object({
    orderedMediaIds: z.array(z.string().uuid()).min(1),
});
