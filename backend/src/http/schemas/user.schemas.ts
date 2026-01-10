import { z } from 'zod';

export const userIdParamsSchema = z.object({
    id: z.string().uuid(),
});

export const userPatchSelfSchema = z.object({
    // TODO: Birth-date update thru moderator

    bio: z.string().max(1000).nullable().optional(),
    website: z.string().url().max(300).nullable().optional(),

    showComments: z.boolean().optional(),
    showRatings: z.boolean().optional(),
    showFavorites: z.boolean().optional(),
    showUploads: z.boolean().optional(),
});
